import {
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    ACHIEVEMENT_EVENTS_PORT,
    AchievementEventsPort,
} from '../realtime/ports/achievement-events.port';
import {
    ACHIEVEMENT_DEFINITIONS,
    AchievementContext,
    AchievementDefinition,
    AchievementHelpers,
} from './achievement-definitions';
import { StreakOutcome } from './streak.util';

export interface UserAchievementView {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: string;
    tier: string;
    sortOrder: number;
    unlocked: boolean;
    unlockedAt: string | null;
}

/**
 * Inputs the trigger sites collect; the service translates them into a full
 * `AchievementContext` (filling in helpers + post-event user stats).
 */
export interface BattleCompletionInput {
    userId: string;
    battle: AchievementContext['battle'];
}

export interface ProblemApprovalInput {
    userId: string;
    submissionId: string;
}

export interface SeasonTopFinishInput {
    userId: string;
    seasonId: string;
    placement: number;
}

@Injectable()
export class AchievementsService implements OnModuleInit {
    private readonly logger = new Logger(AchievementsService.name);

    constructor(
        private prisma: PrismaService,
        @Inject(ACHIEVEMENT_EVENTS_PORT)
        private events: AchievementEventsPort,
    ) {}

    async onModuleInit() {
        await this.seedDefinitions();
    }

    /**
     * Upsert every code-defined achievement into the catalog table. Code is
     * the source of truth — adding/editing definitions is a code change, not
     * a data migration. Safe to call repeatedly.
     */
    async seedDefinitions(): Promise<void> {
        for (const def of ACHIEVEMENT_DEFINITIONS) {
            await this.prisma.achievement.upsert({
                where: { id: def.id },
                create: {
                    id: def.id,
                    title: def.title,
                    description: def.description,
                    icon: def.icon,
                    category: def.category,
                    tier: def.tier,
                    sortOrder: def.sortOrder,
                },
                update: {
                    title: def.title,
                    description: def.description,
                    icon: def.icon,
                    category: def.category,
                    tier: def.tier,
                    sortOrder: def.sortOrder,
                },
            });
        }
        this.logger.log(
            `Seeded ${ACHIEVEMENT_DEFINITIONS.length} achievement definitions`,
        );
    }

    /**
     * Returns every defined achievement annotated with whether `userId` has
     * unlocked it (and when). Single Prisma query plus an in-memory merge so
     * the table doesn't need to be re-fetched if definitions are removed.
     */
    async listForUser(userId: string): Promise<UserAchievementView[]> {
        const unlocks = await this.prisma.userAchievement.findMany({
            where: { userId },
            select: { achievementId: true, unlockedAt: true },
        });
        const unlockedMap = new Map<string, Date>();
        for (const u of unlocks) {
            unlockedMap.set(u.achievementId, u.unlockedAt as Date);
        }

        return ACHIEVEMENT_DEFINITIONS.map((def) => {
            const unlockedAt = unlockedMap.get(def.id);
            return {
                id: def.id,
                title: def.title,
                description: def.description,
                icon: def.icon,
                category: def.category,
                tier: def.tier,
                sortOrder: def.sortOrder,
                unlocked: !!unlockedAt,
                unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
            };
        }).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    /**
     * Run all checkers against the given context. Persists newly unlocked
     * achievements (idempotent — relies on the unique index) and emits a
     * websocket event per fresh unlock. Returns the slugs that were just
     * unlocked (excluding any that were already unlocked).
     */
    async runChecks(ctxInput: {
        userId: string;
        user: AchievementContext['user'];
        battle?: AchievementContext['battle'];
        approvedProblemSubmissionId?: string;
        seasonTopPlacement?: AchievementContext['seasonTopPlacement'];
    }): Promise<string[]> {
        const alreadyUnlocked = await this.prisma.userAchievement.findMany({
            where: { userId: ctxInput.userId },
            select: { achievementId: true },
        });
        const alreadyUnlockedSet = new Set(
            alreadyUnlocked.map((u) => u.achievementId),
        );

        const candidates = ACHIEVEMENT_DEFINITIONS.filter(
            (d) => !alreadyUnlockedSet.has(d.id),
        );
        if (candidates.length === 0) return [];

        const helpers = this.buildHelpers(ctxInput.userId);
        const ctx: AchievementContext = {
            ...ctxInput,
            helpers,
        };

        const newlyUnlocked: AchievementDefinition[] = [];
        for (const def of candidates) {
            try {
                const ok = await def.check(ctx);
                if (ok) newlyUnlocked.push(def);
            } catch (err) {
                this.logger.error(
                    `Checker for ${def.id} threw: ${(err as Error).message}`,
                );
            }
        }

        if (newlyUnlocked.length === 0) return [];

        const now = new Date();
        await this.prisma.userAchievement.createMany({
            data: newlyUnlocked.map((def) => ({
                userId: ctxInput.userId,
                achievementId: def.id,
                unlockedAt: now,
            })),
            skipDuplicates: true,
        });

        for (const def of newlyUnlocked) {
            this.events.emitAchievementUnlocked(ctxInput.userId, {
                userId: ctxInput.userId,
                achievementId: def.id,
                title: def.title,
                description: def.description,
                icon: def.icon,
                tier: def.tier,
                unlockedAt: now,
            });
        }

        return newlyUnlocked.map((d) => d.id);
    }

    /**
     * Convenience wrapper for the top-100 season trigger; loads user stats so
     * MMR-based checks can also fire if applicable.
     */
    async runChecksForSeasonTop(input: SeasonTopFinishInput): Promise<string[]> {
        const user = await this.prisma.user.findUnique({
            where: { id: input.userId },
            select: { wins: true, losses: true, mmr: true },
        });
        if (!user) {
            throw new NotFoundException(`User ${input.userId} not found`);
        }
        return this.runChecks({
            userId: input.userId,
            user,
            seasonTopPlacement: {
                seasonId: input.seasonId,
                placement: input.placement,
            },
        });
    }

    private buildHelpers(userId: string): AchievementHelpers {
        let outcomesCache: StreakOutcome[] | null = null;
        let langCountCache: Map<string, number> | null = null;
        let distinctLangCache: number | null = null;
        let perfectWinsCache: number | null = null;
        let clanWarWinsCache: number | null = null;

        return {
            recentOutcomes: async () => {
                if (outcomesCache) return outcomesCache;
                outcomesCache = await this.fetchRecentOutcomes(userId);
                return outcomesCache;
            },
            countWinsByLanguage: async (language: string) => {
                if (!langCountCache) langCountCache = new Map();
                const cached = langCountCache.get(language);
                if (cached != null) return cached;
                const n = await this.prisma.battleParticipant.count({
                    where: {
                        userId,
                        language,
                        battle: {
                            winnerId: userId,
                            status: 'COMPLETED',
                        },
                    },
                });
                langCountCache.set(language, n);
                return n;
            },
            countDistinctWinningLanguages: async () => {
                if (distinctLangCache != null) return distinctLangCache;
                const rows = await this.prisma.battleParticipant.findMany({
                    where: {
                        userId,
                        language: { not: null },
                        battle: {
                            winnerId: userId,
                            status: 'COMPLETED',
                        },
                    },
                    select: { language: true },
                });
                distinctLangCache = new Set(
                    rows.map((r) => r.language).filter(Boolean) as string[],
                ).size;
                return distinctLangCache;
            },
            countWinsAt100PercentTests: async () => {
                if (perfectWinsCache != null) return perfectWinsCache;
                const rows = await this.prisma.battleParticipant.findMany({
                    where: {
                        userId,
                        battle: { winnerId: userId, status: 'COMPLETED' },
                    },
                    select: { testsPassed: true, totalTests: true },
                });
                perfectWinsCache = rows.filter(
                    (r) => r.totalTests > 0 && r.testsPassed === r.totalTests,
                ).length;
                return perfectWinsCache;
            },
            countClanWarsWins: async () => {
                if (clanWarWinsCache != null) return clanWarWinsCache;
                const rows = await this.prisma.battleParticipant.findMany({
                    where: {
                        userId,
                        teamId: { not: null },
                        battle: {
                            mode: { in: ['CLAN_WARS', 'CLAN_VS_CLAN'] },
                            status: 'COMPLETED',
                            winningTeam: { not: null },
                        },
                    },
                    select: {
                        teamId: true,
                        battle: { select: { winningTeam: true } },
                    },
                });
                clanWarWinsCache = rows.filter(
                    (r) => r.battle && r.teamId === r.battle.winningTeam,
                ).length;
                return clanWarWinsCache;
            },
        };
    }

    private async fetchRecentOutcomes(
        userId: string,
    ): Promise<StreakOutcome[]> {
        const rows = await this.prisma.battleParticipant.findMany({
            where: { userId, battle: { status: 'COMPLETED' } },
            orderBy: { battle: { endedAt: 'desc' } },
            take: 50,
            select: {
                teamId: true,
                battle: {
                    select: {
                        mode: true,
                        winnerId: true,
                        winningTeam: true,
                    },
                },
            },
        });

        const TEAM_MODES = new Set(['GROUP', 'CLAN_VS_CLAN', 'CLAN_WARS']);
        const outcomes: StreakOutcome[] = [];
        for (const row of rows) {
            const b = row.battle;
            if (!b) continue;
            if (TEAM_MODES.has(b.mode)) {
                if (!b.winningTeam || !row.teamId) {
                    outcomes.push('D');
                    continue;
                }
                outcomes.push(row.teamId === b.winningTeam ? 'W' : 'L');
            } else {
                if (!b.winnerId) {
                    outcomes.push('D');
                    continue;
                }
                outcomes.push(b.winnerId === userId ? 'W' : 'L');
            }
        }
        return outcomes;
    }
}
