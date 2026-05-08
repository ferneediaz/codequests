import {
    Injectable,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BattlesService } from '../battles/battles.service';
import { BattleMode, MatchmakingStatus, Difficulty } from '@prisma/client';
import { BattlesGateway } from '../websockets/battles.gateway';
import { JoinQueueDto } from './dto/join-queue.dto';

// MMR matching constants
const BASE_MMR_RANGE = 100;
const MMR_RANGE_EXPANSION_PER_INTERVAL = 50;
const MMR_RANGE_EXPANSION_INTERVAL_MS = 30_000; // 30 seconds
const MAX_MMR_RANGE = 500;
const QUEUE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const QUEUE_PROCESS_INTERVAL_MS = 5_000; // 5 seconds

@Injectable()
export class MatchmakingService {
    private readonly logger = new Logger(MatchmakingService.name);

    constructor(
        private prisma: PrismaService,
        private battlesService: BattlesService,
        private battlesGateway: BattlesGateway,
    ) {}

    /**
     * Add a user to the matchmaking queue
     */
    async joinQueue(userId: string, dto: JoinQueueDto) {
        const mode = dto.mode || BattleMode.ONE_V_ONE;

        // Battle Royale is lobby-only: it cannot be formed via matchmaking
        // because the host supplies per-round configuration up front.
        if (mode === BattleMode.BATTLE_ROYALE) {
            throw new BadRequestException(
                'Battle Royale is lobby-only and cannot be joined via matchmaking',
            );
        }

        // Check user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new BadRequestException('User not found');
        }

        // Always wipe any existing entry. Previously we threw "already in
        // matchmaking queue" when the user re-clicked Find Match, but that
        // strands anyone whose Cancel call failed or whose entry got stuck
        // QUEUED after a tab close. Re-clicking Find Match is an unambiguous
        // "I want to (re)queue" signal — honor it by replacing the entry.
        const existing = await this.prisma.matchmakingEntry.findUnique({
            where: { userId },
        });
        if (existing) {
            await this.prisma.matchmakingEntry.delete({
                where: { userId },
            });
        }

        // Force-finalize ANY active battle this user is in. Clicking Find
        // Match is an explicit "I'm done with my current game" signal — we
        // honor it by ending the lingering battle as a draw (no MMR movement
        // for unsubmitted battles). The other participant, if any, gets a
        // `battle.completed` event and bounces to /results. This replaces
        // the old "you are already in an active battle" hard-block, which
        // stranded users whose previous /complete call never landed (tab
        // closed mid-game, websocket dropped, etc.).
        try {
            await this.battlesService.forceFinalizeActiveBattlesForUser(userId);
        } catch (error) {
            this.logger.warn(
                `Active-battle cleanup before joinQueue failed for user ${userId}: ${(error as Error).message}`,
            );
        }

        // Create queue entry
        const entry = await this.prisma.matchmakingEntry.create({
            data: {
                userId,
                mode,
                preferredDifficulty: dto.preferredDifficulty || null,
                preferredTopic: dto.preferredTopic || null,
                mmrAtQueue: user.mmr,
            },
        });

        // Try to find an immediate match
        const match = await this.tryFindMatch(entry.id);

        if (match) {
            return {
                status: 'matched' as const,
                battleId: match.battleId,
                entry,
            };
        }

        return {
            status: 'queued' as const,
            entry,
        };
    }

    /**
     * Remove a user from the matchmaking queue
     */
    async leaveQueue(userId: string) {
        const entry = await this.prisma.matchmakingEntry.findUnique({
            where: { userId },
        });

        if (!entry || entry.status !== MatchmakingStatus.QUEUED) {
            throw new BadRequestException('Not currently in matchmaking queue');
        }

        await this.prisma.matchmakingEntry.delete({
            where: { userId },
        });

        return { status: 'left' as const };
    }

    /**
     * Get queue status for a user
     */
    async getQueueStatus(userId: string) {
        const entry = await this.prisma.matchmakingEntry.findUnique({
            where: { userId },
        });

        if (!entry || entry.status !== MatchmakingStatus.QUEUED) {
            return { inQueue: false };
        }

        // Count how many others are queued for the same mode
        const queuedCount = await this.prisma.matchmakingEntry.count({
            where: {
                mode: entry.mode,
                status: MatchmakingStatus.QUEUED,
            },
        });

        return {
            inQueue: true,
            id: entry.id,
            mode: entry.mode,
            preferredDifficulty: entry.preferredDifficulty,
            status: entry.status,
            queuedAt: entry.queuedAt,
            playersInQueue: queuedCount,
        };
    }

    /**
     * Calculate the MMR range for matching based on time in queue
     */
    calculateMmrRange(queuedAt: Date, now: Date = new Date()): number {
        const waitTimeMs = now.getTime() - queuedAt.getTime();
        const expansions = Math.floor(
            waitTimeMs / MMR_RANGE_EXPANSION_INTERVAL_MS,
        );
        return Math.min(
            BASE_MMR_RANGE + expansions * MMR_RANGE_EXPANSION_PER_INTERVAL,
            MAX_MMR_RANGE,
        );
    }

    /**
     * Try to find a match for a specific queue entry
     */
    async tryFindMatch(
        entryId: string,
    ): Promise<{ battleId: string; player1Id: string; player2Id: string } | null> {
        const entry = await this.prisma.matchmakingEntry.findUnique({
            where: { id: entryId },
        });

        if (!entry || entry.status !== MatchmakingStatus.QUEUED) {
            return null;
        }

        const now = new Date();
        const mmrRange = this.calculateMmrRange(entry.queuedAt, now);

        // Find potential matches: same mode, QUEUED, within MMR range, not same user.
        // Belt-and-suspenders userId guard: a unique constraint on userId
        // already enforces "one entry per user", but explicitly excluding
        // entry.userId means a self-match is impossible even if a duplicate
        // row ever sneaks in (migration drift, manual DB writes, etc.).
        const candidates = await this.prisma.matchmakingEntry.findMany({
            where: {
                id: { not: entry.id },
                userId: { not: entry.userId },
                mode: entry.mode,
                status: MatchmakingStatus.QUEUED,
                mmrAtQueue: {
                    gte: entry.mmrAtQueue - mmrRange,
                    lte: entry.mmrAtQueue + mmrRange,
                },
            },
            orderBy: [
                { queuedAt: 'asc' }, // Oldest first (they've waited longest)
            ],
        });

        if (candidates.length === 0) {
            return null;
        }

        // If preferred difficulty set, prefer candidates with same preference (or no preference)
        let bestMatch = candidates[0];
        if (entry.preferredDifficulty) {
            const exactMatch = candidates.find(
                (c) => c.preferredDifficulty === entry.preferredDifficulty,
            );
            if (exactMatch) {
                bestMatch = exactMatch;
            }
        }

        // Create the battle
        return this.createMatchedBattle(entry, bestMatch);
    }

    /**
     * Create a battle from two matched queue entries
     */
    private async createMatchedBattle(
        entry1: { id: string; userId: string; mode: BattleMode; preferredDifficulty: Difficulty | null; preferredTopic: string | null },
        entry2: { id: string; userId: string; mode: BattleMode; preferredDifficulty: Difficulty | null; preferredTopic: string | null },
    ): Promise<{ battleId: string; player1Id: string; player2Id: string } | null> {
        // Pick a random problem, optionally filtered by difficulty and topic
        const difficulty =
            entry1.preferredDifficulty || entry2.preferredDifficulty || undefined;
        const topic =
            entry1.preferredTopic || entry2.preferredTopic || undefined;

        const whereClause: any = {};
        if (difficulty) whereClause.difficulty = difficulty;
        if (topic) whereClause.tags = { has: topic };

        let problemCount = await this.prisma.problem.count({
            where: whereClause,
        });

        // Fallback: if no problems match the topic filter, try without topic
        let effectiveWhere = whereClause;
        if (problemCount === 0 && topic) {
            const fallbackWhere: any = {};
            if (difficulty) fallbackWhere.difficulty = difficulty;
            problemCount = await this.prisma.problem.count({ where: fallbackWhere });
            effectiveWhere = fallbackWhere;
        }

        // Final fallback: if difficulty filter also matched nothing, try any problem
        if (problemCount === 0 && difficulty) {
            problemCount = await this.prisma.problem.count({ where: {} });
            effectiveWhere = {};
        }

        if (problemCount === 0) {
            // No problems available at all — can't create a battle
            this.logger.warn(
                'No problems available for matchmaking, skipping match',
            );
            return null;
        }

        const skip = Math.floor(Math.random() * problemCount);
        const problem = await this.prisma.problem.findFirst({
            where: effectiveWhere,
            skip,
        });

        if (!problem) {
            return null;
        }

        // Atomically claim both entries: only flip QUEUED -> MATCHED.
        // If a concurrent matcher already grabbed either side, count != 2
        // and we bail out so we don't create a phantom battle on top of
        // the first matcher's. The previous version updated unconditionally,
        // which let two concurrent matchers each spin up a battle and split
        // the players across them.
        const now = new Date();
        const claim = await this.prisma.matchmakingEntry.updateMany({
            where: {
                id: { in: [entry1.id, entry2.id] },
                status: MatchmakingStatus.QUEUED,
            },
            data: { status: MatchmakingStatus.MATCHED, matchedAt: now },
        });
        if (claim.count !== 2) {
            // Partial claim: we grabbed one entry but not the other (the
            // peer was already MATCHED by a concurrent caller). Revert
            // *only* the row(s) we just flipped — the `matchedAt: now`
            // filter pins us to our own write so we don't clobber the
            // other matcher's claim. Without this, a losing partial-claim
            // strands an entry in MATCHED forever.
            if (claim.count > 0) {
                await this.prisma.matchmakingEntry.updateMany({
                    where: {
                        id: { in: [entry1.id, entry2.id] },
                        status: MatchmakingStatus.MATCHED,
                        matchedAt: now,
                    },
                    data: {
                        status: MatchmakingStatus.QUEUED,
                        matchedAt: null,
                    },
                });
            }
            this.logger.warn(
                `Matchmaking claim race: tried to match ${entry1.id} & ${entry2.id} but only ${claim.count} were still QUEUED — backing off`,
            );
            return null;
        }

        try {
            // Create battle via BattlesService
            const battle = await this.battlesService.createBattle(entry1.userId, {
                problemId: problem.id,
                mode: entry1.mode,
            });

            // Have the second player join
            await this.battlesService.joinBattle(entry2.userId, battle.id);

            // Clean up matched entries
            await this.prisma.matchmakingEntry.deleteMany({
                where: { id: { in: [entry1.id, entry2.id] } },
            });

            // Notify both players via WebSocket
            this.battlesGateway.emitMatchFound(entry1.userId, {
                battleId: battle.id,
                opponentId: entry2.userId,
            });
            this.battlesGateway.emitMatchFound(entry2.userId, {
                battleId: battle.id,
                opponentId: entry1.userId,
            });

            this.logger.log(
                `Match found! Players ${entry1.userId} vs ${entry2.userId} → Battle ${battle.id}`,
            );

            return {
                battleId: battle.id,
                player1Id: entry1.userId,
                player2Id: entry2.userId,
            };
        } catch (error) {
            // Roll back: revert entries to QUEUED so they can be matched again
            this.logger.error(
                `Failed to create battle for match: ${(error as Error).message}`,
            );
            await this.prisma.matchmakingEntry.updateMany({
                where: { id: { in: [entry1.id, entry2.id] } },
                data: { status: MatchmakingStatus.QUEUED, matchedAt: null },
            });
            return null;
        }
    }

    /**
     * Periodically process the queue to find matches and expire old entries
     */
    @Interval(QUEUE_PROCESS_INTERVAL_MS)
    async processQueue() {
        try {
            await this.expireStaleEntries();
            await this.matchQueuedPlayers();
        } catch (error) {
            this.logger.error(
                `Queue processing error: ${(error as Error).message}`,
            );
        }
    }

    /**
     * Expire entries that have been in queue too long
     */
    async expireStaleEntries(): Promise<number> {
        const cutoff = new Date(Date.now() - QUEUE_EXPIRY_MS);

        const result = await this.prisma.matchmakingEntry.deleteMany({
            where: {
                status: MatchmakingStatus.QUEUED,
                queuedAt: { lt: cutoff },
            },
        });

        if (result.count > 0) {
            this.logger.log(`Expired ${result.count} stale queue entries`);
        }

        return result.count;
    }

    /**
     * Scan queue and attempt to match players
     */
    async matchQueuedPlayers(): Promise<number> {
        const queuedEntries = await this.prisma.matchmakingEntry.findMany({
            where: { status: MatchmakingStatus.QUEUED },
            orderBy: { queuedAt: 'asc' },
        });

        let matchCount = 0;

        // Track which entries have been matched this cycle
        const matchedIds = new Set<string>();

        for (const entry of queuedEntries) {
            if (matchedIds.has(entry.id)) continue;

            const match = await this.tryFindMatch(entry.id);
            if (match) {
                matchedIds.add(entry.id);
                // Find the other matched entry to skip it
                const otherEntry = queuedEntries.find(
                    (e) =>
                        e.userId === match.player2Id && !matchedIds.has(e.id),
                );
                if (otherEntry) {
                    matchedIds.add(otherEntry.id);
                }
                matchCount++;
            }
        }

        return matchCount;
    }
}
