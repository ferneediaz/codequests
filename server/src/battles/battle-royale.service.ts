import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
    BattleMode,
    BattleRoundEndReason,
    BattleRoundStatus,
    BattleRoyaleFormat,
    BattleStatus,
    Difficulty,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import {
    BATTLE_EVENTS_PORT,
    BattleEventsPort,
} from '../realtime/ports/battle-events.port';
import { CreateBattleDto } from './dto/create-battle.dto';
import { RoundConfigDto } from './dto/round-config.dto';
import { RoyalePresetDto } from './dto/royale-preset.dto';
import { SubmissionResult } from './types/battle-submission.types';
import { getRankTier, RankTier } from '../common/utils/rank-tiers';

// ============================================
// Constants
// ============================================

const ELO_K_FACTOR = 16;
const MIN_MMR = 0;

const MIN_MAX_PLAYERS = 3;
const MAX_MAX_PLAYERS = 50;
const MIN_ROUND_SECONDS = 10;
const MAX_ROUND_SECONDS = 7200;

// Difficulty → point values for SCORE_ATTACK
const DIFFICULTY_POINTS: Record<Difficulty, number> = {
    EASY: 2,
    MEDIUM: 5,
    HARD: 10,
};

// ============================================
// Types
// ============================================

export interface StandingsEntry {
    userId: string;
    username?: string;
    avatarUrl?: string | null;
    mmr?: number;
    tier?: RankTier;
    isEliminated: boolean;
    placement: number | null;
    eliminatedInRound: number | null;
    cumulativePoints: number;
    roundPoints: number;
    testsPassed: number;
    totalTests: number;
    lastSubmittedAt: Date | null;
}

// ============================================
// Service
// ============================================

@Injectable()
export class BattleRoyaleService {
    private readonly logger = new Logger(BattleRoyaleService.name);

    constructor(
        private prisma: PrismaService,
        private codeExecutionService: CodeExecutionService,
        private subscriptionsService: SubscriptionsService,
        private seasonsService: SeasonsService,
        private problemsService: ProblemsService,
        private scheduler: SchedulerRegistry,
        @Inject(BATTLE_EVENTS_PORT)
        private gateway: BattleEventsPort,
    ) { }

    // ========================================
    // Presets
    // ========================================

    /**
     * Server-owned reference presets. These are convenient starting points the
     * client can mutate before POSTing. They are NOT enforced — clients can
     * always POST fully custom configurations.
     */
    getPresets(): RoyalePresetDto[] {
        return [
            {
                id: 'classic-8',
                name: 'Classic 8',
                description: '8 players, 3 rounds of same problem. [3, 3, 1] eliminations.',
                battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                maxPlayers: 8,
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 3 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            },
            {
                id: 'classic-6',
                name: 'Classic 6',
                description: '6 players, 3 rounds of same problem. [2, 2, 1] eliminations.',
                battleRoyaleFormat: BattleRoyaleFormat.SAME_PROBLEM,
                maxPlayers: 6,
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 2 },
                    { timeLimitSeconds: 300, eliminateCount: 2 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            },
            {
                id: 'score-attack-10',
                name: 'Score Attack 10',
                description:
                    '10 players, 4 rounds of score attack. Solve as many problems as you can per round.',
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                maxPlayers: 10,
                rounds: [
                    { timeLimitSeconds: 600, eliminateCount: 3 },
                    { timeLimitSeconds: 600, eliminateCount: 3 },
                    { timeLimitSeconds: 600, eliminateCount: 2 },
                    { timeLimitSeconds: 600, eliminateCount: 1 },
                ],
            },
            {
                id: 'mega-20',
                name: 'Mega Royale 20',
                description:
                    '20 players, 5 rounds of score attack. Long rounds with a 1v1 finale.',
                battleRoyaleFormat: BattleRoyaleFormat.SCORE_ATTACK,
                maxPlayers: 20,
                rounds: [
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 5 },
                    { timeLimitSeconds: 1800, eliminateCount: 3 },
                    { timeLimitSeconds: 900, eliminateCount: 1 },
                ],
            },
        ];
    }

    // ========================================
    // Config validation (pure)
    // ========================================

    /**
     * Validates the BR creation DTO *shape* (ignoring DB-dependent checks).
     *
     * Rules enforced:
     *  - mode === BATTLE_ROYALE
     *  - battleRoyaleFormat provided
     *  - maxPlayers in [3, 50]
     *  - rounds.length >= 2 and <= maxPlayers - 1
     *  - every timeLimitSeconds in [10, 7200]
     *  - every eliminateCount >= 0
     *  - sum(eliminateCount) === maxPlayers - 1 (exactly one winner)
     *  - for every prefix, maxPlayers - sumSoFar >= 1 (never over-eliminate)
     *  - last round eliminateCount === 1 (BR must end in a 1v1 finale — this
     *    combined with sum === maxPlayers-1 implies the final round begins
     *    with exactly 2 players)
     */
    validateConfig(dto: CreateBattleDto): void {
        if (dto.mode !== BattleMode.BATTLE_ROYALE) {
            throw new BadRequestException(
                'battleRoyaleFormat is only valid for BATTLE_ROYALE mode',
            );
        }
        if (!dto.battleRoyaleFormat) {
            throw new BadRequestException(
                'battleRoyaleFormat is required for Battle Royale',
            );
        }
        if (
            dto.maxPlayers === undefined ||
            dto.maxPlayers === null ||
            !Number.isInteger(dto.maxPlayers)
        ) {
            throw new BadRequestException('maxPlayers is required for Battle Royale');
        }
        if (dto.maxPlayers < MIN_MAX_PLAYERS || dto.maxPlayers > MAX_MAX_PLAYERS) {
            throw new BadRequestException(
                `maxPlayers must be between ${MIN_MAX_PLAYERS} and ${MAX_MAX_PLAYERS}`,
            );
        }
        const rounds = dto.rounds;
        if (!rounds || rounds.length < 2) {
            throw new BadRequestException(
                'rounds must contain at least two round configurations',
            );
        }
        if (rounds.length > dto.maxPlayers - 1) {
            throw new BadRequestException(
                `rounds.length (${rounds.length}) cannot exceed maxPlayers - 1 (${dto.maxPlayers - 1})`,
            );
        }

        let sumEliminations = 0;
        let remaining = dto.maxPlayers;
        for (let i = 0; i < rounds.length; i++) {
            const r = rounds[i];
            if (!Number.isInteger(r.timeLimitSeconds)) {
                throw new BadRequestException(
                    `Round ${i + 1}: timeLimitSeconds must be an integer`,
                );
            }
            if (
                r.timeLimitSeconds < MIN_ROUND_SECONDS ||
                r.timeLimitSeconds > MAX_ROUND_SECONDS
            ) {
                throw new BadRequestException(
                    `Round ${i + 1}: timeLimitSeconds must be between ${MIN_ROUND_SECONDS} and ${MAX_ROUND_SECONDS}`,
                );
            }
            if (
                r.eliminateCount === undefined ||
                !Number.isInteger(r.eliminateCount) ||
                r.eliminateCount < 0
            ) {
                throw new BadRequestException(
                    `Round ${i + 1}: eliminateCount must be a non-negative integer`,
                );
            }
            sumEliminations += r.eliminateCount;
            remaining -= r.eliminateCount;
            if (remaining < 1) {
                throw new BadRequestException(
                    `Round ${i + 1}: eliminateCount leaves fewer than 1 remaining player (over-elimination)`,
                );
            }
        }

        if (sumEliminations !== dto.maxPlayers - 1) {
            throw new BadRequestException(
                `Sum of eliminateCount across rounds (${sumEliminations}) must equal maxPlayers - 1 (${dto.maxPlayers - 1})`,
            );
        }
        // Every Battle Royale must end in a 1v1 finale: the last round must
        // start with exactly 2 players and eliminate exactly 1. Combined with
        // the "sum === maxPlayers - 1" rule this means sum(rounds[:-1]) must
        // equal maxPlayers - 2.
        if (rounds[rounds.length - 1].eliminateCount !== 1) {
            throw new BadRequestException(
                'The last round must eliminate exactly 1 player (Battle Royale must end in a 1v1 finale)',
            );
        }
    }

    // ========================================
    // Create
    // ========================================

    /**
     * Create a Battle Royale battle (lobby).
     *
     * - Validates the host is allowed to play (subscription gate)
     * - Validates the config
     * - For SAME_PROBLEM, verifies enough distinct problems are available
     * - For SCORE_ATTACK with explicit `problemIds`, verifies all exist
     * - Creates the Battle + creator BattleParticipant + one BattleRound per
     *   configured round (all PENDING)
     */
    async createRoyaleBattle(userId: string, dto: CreateBattleDto) {
        // Subscription / daily limit gate
        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }

        // Shape validation
        this.validateConfig(dto);

        // Verify user exists
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const format = dto.battleRoyaleFormat!;
        const rounds = dto.rounds!;

        // Resolve problems per format (DB-level validation)
        if (format === BattleRoyaleFormat.SAME_PROBLEM) {
            // Need at least rounds.length distinct problems. We do NOT apply
            // preferredDifficulty / preferredTopic here because at round-start
            // time we pick without those filters (they'd be lost across
            // round starts since they aren't persisted on the battle). Keeping
            // the pre-check in sync with the runtime picker is what matters.
            const available = await this.prisma.problem.count();
            if (available < rounds.length) {
                throw new BadRequestException(
                    `Not enough distinct problems available (${available}) to cover ${rounds.length} SAME_PROBLEM rounds`,
                );
            }
        } else if (format === BattleRoyaleFormat.SCORE_ATTACK) {
            if (dto.problemIds && dto.problemIds.length > 0) {
                const found = await this.prisma.problem.count({
                    where: { id: { in: dto.problemIds } },
                });
                if (found !== dto.problemIds.length) {
                    throw new BadRequestException(
                        'One or more problemIds do not exist',
                    );
                }
            } else {
                // Server will auto-sample the pool at round start time; ensure at
                // least a couple of problems exist.
                const count = await this.prisma.problem.count();
                if (count === 0) {
                    throw new BadRequestException(
                        'No problems available to build a SCORE_ATTACK pool',
                    );
                }
            }
        }

        // Active season
        const activeSeason = await this.seasonsService.getActiveSeason();

        // Create battle + creator participant + rounds (all PENDING) in one call
        const battle = await this.prisma.battle.create({
            data: {
                mode: BattleMode.BATTLE_ROYALE,
                battleRoyaleFormat: format,
                maxPlayers: dto.maxPlayers,
                currentRound: 0,
                timeLimitMinutes: 5, // unused for BR but required by schema default
                enabledSkills: dto.enabledSkills || [],
                seasonId: activeSeason?.id || null,
                status: BattleStatus.WAITING,
                participants: {
                    create: {
                        userId,
                        totalTests: 0,
                    },
                },
                rounds: {
                    create: rounds.map((r, idx) => ({
                        roundNumber: idx + 1,
                        timeLimitSeconds: r.timeLimitSeconds,
                        eliminateCount: r.eliminateCount ?? 0,
                        status: BattleRoundStatus.PENDING,
                    })),
                },
            },
        });

        // For SCORE_ATTACK with a provided pool, persist it via ProblemPool so we
        // have a stable pool throughout the battle (auto-sample handled at start).
        if (
            format === BattleRoyaleFormat.SCORE_ATTACK &&
            dto.problemIds &&
            dto.problemIds.length > 0
        ) {
            const poolProblems = await this.prisma.problem.findMany({
                where: { id: { in: dto.problemIds } },
                select: { id: true, difficulty: true },
            });
            await this.prisma.problemPool.create({
                data: {
                    battleId: battle.id,
                    items: {
                        create: poolProblems.map((p) => ({
                            problemId: p.id,
                            pointValue: DIFFICULTY_POINTS[p.difficulty],
                        })),
                    },
                },
            });
        }

        return this.getRoyaleDetails(battle.id);
    }

    /**
     * Join-cap enforcement; called from BattlesService.joinBattle when the
     * battle is BR. Throws if the lobby is already full.
     */
    enforceRoyaleJoinCap(battle: { maxPlayers: number | null; participants: { id: string }[] }) {
        if (battle.maxPlayers === null || battle.maxPlayers === undefined) {
            throw new BadRequestException(
                'Battle Royale battle is missing maxPlayers',
            );
        }
        if (battle.participants.length >= battle.maxPlayers) {
            throw new BadRequestException('Battle Royale lobby is full');
        }
    }

    // ========================================
    // Start
    // ========================================

    /**
     * Called from BattlesService.readyUp when all participants are ready and
     * mode is BATTLE_ROYALE. Requires a full lobby (maxPlayers met) for v1.
     */
    async startRoyale(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                rounds: { orderBy: { roundNumber: 'asc' } },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.BATTLE_ROYALE) {
            throw new BadRequestException('Battle is not a Battle Royale');
        }
        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not in waiting state');
        }
        if (!battle.maxPlayers) {
            throw new BadRequestException('Battle Royale is missing maxPlayers');
        }
        if (battle.participants.length !== battle.maxPlayers) {
            throw new BadRequestException(
                `Battle Royale lobby must be full (${battle.participants.length}/${battle.maxPlayers})`,
            );
        }

        await this.prisma.battle.update({
            where: { id: battleId },
            data: {
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date(),
                currentRound: 1,
            },
        });

        // Daily game counts bump for every participant
        for (const p of battle.participants) {
            await this.subscriptionsService.incrementGamesPlayed(p.userId);
        }

        await this.startRound(battleId, 1);
    }

    /**
     * Flip a round to IN_PROGRESS, pick a problem for SAME_PROBLEM rounds,
     * schedule the round timer, and broadcast round_start.
     */
    async startRound(battleId: string, roundNumber: number) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                rounds: { orderBy: { roundNumber: 'asc' } },
                participants: true,
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        const round = battle.rounds.find((r) => r.roundNumber === roundNumber);
        if (!round) {
            throw new NotFoundException(`Round ${roundNumber} not found`);
        }
        if (round.status !== BattleRoundStatus.PENDING) {
            throw new BadRequestException(
                `Round ${roundNumber} is not PENDING (status=${round.status})`,
            );
        }

        // SAME_PROBLEM: pick a problem not yet used in this battle.
        // We pick pseudo-randomly by counting + offset instead of ordering
        // alphabetically so distinct battles don't always start with the same
        // problem. Any problem not already used in this battle is eligible.
        let problemId: string | null = null;
        if (battle.battleRoyaleFormat === BattleRoyaleFormat.SAME_PROBLEM) {
            const usedIds = battle.rounds
                .filter((r) => r.problemId)
                .map((r) => r.problemId as string);
            const where: any = usedIds.length
                ? { id: { notIn: usedIds } }
                : {};
            const eligibleCount = await this.prisma.problem.count({ where });
            if (eligibleCount === 0) {
                throw new BadRequestException(
                    `No distinct problem available for round ${roundNumber}`,
                );
            }
            const skip = Math.floor(Math.random() * eligibleCount);
            const candidate = await this.prisma.problem.findFirst({
                where,
                skip,
                orderBy: { id: 'asc' },
            });
            if (!candidate) {
                throw new BadRequestException(
                    `No distinct problem available for round ${roundNumber}`,
                );
            }
            problemId = candidate.id;
        }

        const startedAt = new Date();
        await this.prisma.battleRound.update({
            where: { id: round.id },
            data: {
                status: BattleRoundStatus.IN_PROGRESS,
                startedAt,
                problemId,
            },
        });

        // Broadcast round_start
        const nonEliminated = battle.participants.filter((p) => !p.isEliminated);
        this.gateway.emitRoyaleRoundStart(battleId, {
            battleId,
            roundNumber,
            totalRounds: battle.rounds.length,
            problemId,
            timeLimitSeconds: round.timeLimitSeconds,
            eliminateCount: round.eliminateCount,
            remainingUserIds: nonEliminated.map((p) => p.userId),
            startedAt,
        });

        // Schedule the per-round timer
        this.scheduleRoundTimer(
            battleId,
            roundNumber,
            round.timeLimitSeconds,
        );
    }

    /**
     * Internal: schedule a round timer via SchedulerRegistry. Wrapped for tests.
     */
    private scheduleRoundTimer(
        battleId: string,
        roundNumber: number,
        timeLimitSeconds: number,
    ) {
        const name = this.timerName(battleId, roundNumber);
        // Clear any stale timer with the same name
        this.clearRoundTimer(battleId, roundNumber);
        const timeout = setTimeout(
            () => {
                void this.handleRoundTimer(battleId, roundNumber).catch((err) =>
                    this.logger.error(
                        `Round timer handler failed for ${name}: ${(err as Error).message}`,
                    ),
                );
            },
            timeLimitSeconds * 1000,
        );
        this.scheduler.addTimeout(name, timeout);
    }

    private timerName(battleId: string, roundNumber: number): string {
        return `royale:${battleId}:${roundNumber}`;
    }

    private clearRoundTimer(battleId: string, roundNumber: number) {
        const name = this.timerName(battleId, roundNumber);
        try {
            if (this.scheduler.doesExist('timeout', name)) {
                this.scheduler.deleteTimeout(name);
            }
        } catch {
            // no-op: defensive; if scheduler state is odd just move on.
        }
    }

    // ========================================
    // Submit
    // ========================================

    /**
     * Submit a solution during a BR round.
     * - Validates battle/round state and participant eligibility
     * - Validates the problem matches the round (SAME_PROBLEM) or pool
     *   (SCORE_ATTACK)
     * - Runs code, upserts the submission (keeping best)
     * - Emits a standings update
     * - Triggers evaluateRoundEnd which may end the round early
     */
    async submitRoyaleRound(
        battleId: string,
        userId: string,
        code: string,
        language: string,
        problemId?: string,
    ): Promise<SubmissionResult> {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                rounds: { orderBy: { roundNumber: 'asc' } },
                problemPool: { include: { items: true } },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (battle.mode !== BattleMode.BATTLE_ROYALE) {
            throw new BadRequestException('Battle is not a Battle Royale');
        }
        if (battle.status !== BattleStatus.IN_PROGRESS) {
            throw new BadRequestException('Battle is not in progress');
        }

        const participant = battle.participants.find((p) => p.userId === userId);
        if (!participant) {
            throw new ForbiddenException(
                'You are not a participant in this battle',
            );
        }
        if (participant.isEliminated) {
            throw new ForbiddenException('You have been eliminated');
        }

        const round = battle.rounds.find(
            (r) => r.status === BattleRoundStatus.IN_PROGRESS,
        );
        if (!round) {
            throw new BadRequestException('No round is currently in progress');
        }

        // Determine target problem
        let targetProblemId: string;
        let pointsIfAllPassed = 0;
        if (battle.battleRoyaleFormat === BattleRoyaleFormat.SAME_PROBLEM) {
            if (!round.problemId) {
                throw new BadRequestException(
                    'Round is missing a problem — internal state error',
                );
            }
            if (problemId && problemId !== round.problemId) {
                throw new BadRequestException(
                    'Submitted problemId does not match the current round problem',
                );
            }
            targetProblemId = round.problemId;
            // SAME_PROBLEM: no points, just allPassed ranking.
            pointsIfAllPassed = 0;
        } else {
            // SCORE_ATTACK
            if (!problemId) {
                throw new BadRequestException(
                    'problemId is required for SCORE_ATTACK submissions',
                );
            }
            if (!battle.problemPool) {
                // Auto-pool fallback: validate that the problem exists. For the
                // v1 slice we require an explicit pool.
                const exists = await this.prisma.problem.findUnique({
                    where: { id: problemId },
                    select: { id: true, difficulty: true },
                });
                if (!exists) {
                    throw new BadRequestException('Problem not found');
                }
                targetProblemId = exists.id;
                pointsIfAllPassed = DIFFICULTY_POINTS[exists.difficulty];
            } else {
                const item = battle.problemPool.items.find(
                    (i) => i.problemId === problemId,
                );
                if (!item) {
                    throw new BadRequestException(
                        'Problem is not part of the SCORE_ATTACK pool',
                    );
                }
                targetProblemId = item.problemId;
                pointsIfAllPassed = item.pointValue;
            }
        }

        // Execute code
        const execResult = await this.codeExecutionService.executeCode(
            targetProblemId,
            code,
            language,
        );
        const pointsEarned = execResult.allPassed ? pointsIfAllPassed : 0;

        // Upsert: keep best submission (highest points, then allPassed flag,
        // then highest testsPassed). CRITICAL: `participant.pointsEarned` must
        // only be incremented by the *delta* between the new and old row so
        // that re-solving the same problem does not grant points a second
        // time. One problem solved once in a round => awarded once.
        const existing = await this.prisma.battleRoundSubmission.findUnique({
            where: {
                roundId_userId_problemId: {
                    roundId: round.id,
                    userId,
                    problemId: targetProblemId,
                },
            },
        });

        let pointsDelta = 0;
        if (!existing) {
            await this.prisma.battleRoundSubmission.create({
                data: {
                    roundId: round.id,
                    userId,
                    problemId: targetProblemId,
                    code,
                    language,
                    testsPassed: execResult.passed,
                    totalTests: execResult.total,
                    allPassed: execResult.allPassed,
                    pointsEarned,
                },
            });
            pointsDelta = pointsEarned;
        } else {
            // A submission is an improvement if ANY of the following holds
            // (compared to the stored best):
            //   1. it earns more points, OR
            //   2. it earns the same points but flips allPassed false→true
            //      (matters for SAME_PROBLEM where pointsEarned is always 0), OR
            //   3. it earns the same points AND same allPassed AND strictly
            //      more tests pass.
            const isImprovement =
                pointsEarned > existing.pointsEarned ||
                (pointsEarned === existing.pointsEarned &&
                    execResult.allPassed &&
                    !existing.allPassed) ||
                (pointsEarned === existing.pointsEarned &&
                    execResult.allPassed === existing.allPassed &&
                    execResult.passed > existing.testsPassed);
            if (isImprovement) {
                await this.prisma.battleRoundSubmission.update({
                    where: { id: existing.id },
                    data: {
                        code,
                        language,
                        testsPassed: execResult.passed,
                        totalTests: execResult.total,
                        allPassed: execResult.allPassed,
                        pointsEarned,
                        submittedAt: new Date(),
                    },
                });
                pointsDelta = pointsEarned - existing.pointsEarned;
            }
        }

        // Participant UI fields: always reflect the latest submission (code,
        // language, progress, timestamp). pointsEarned is incremented only by
        // the delta so re-solving the same problem does not double-count.
        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: {
                code,
                language,
                testsPassed: execResult.passed,
                totalTests: execResult.total,
                submittedAt: new Date(),
                pointsEarned: { increment: pointsDelta },
            },
        });

        // Broadcast standings
        const standings = await this.getStandings(battleId);
        this.gateway.emitRoyaleStandings(battleId, {
            battleId,
            roundNumber: round.roundNumber,
            standings,
        });

        // Possibly end the round early
        await this.evaluateRoundEnd(battleId, round.id);

        return {
            testsPassed: execResult.passed,
            totalTests: execResult.total,
            allPassed: execResult.allPassed,
            pointsAwarded: pointsEarned,
            results: execResult.results.map((r) => ({
                testCaseId: r.testCaseId,
                passed: r.passed,
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                error: r.error,
            })),
        };
    }

    // ========================================
    // Round end evaluation / advancement
    // ========================================

    /**
     * Called after each submission. For SAME_PROBLEM, if the count of
     * (userId, allPassed=true) submissions in this round reaches
     * `remaining - elim`, ends the round early. SCORE_ATTACK relies solely
     * on the timer, so this is a no-op.
     */
    async evaluateRoundEnd(battleId: string, roundId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true, rounds: true },
        });
        if (!battle) return;
        if (battle.status !== BattleStatus.IN_PROGRESS) return;
        if (battle.battleRoyaleFormat !== BattleRoyaleFormat.SAME_PROBLEM) return;

        const round = battle.rounds.find((r) => r.id === roundId);
        if (!round || round.status !== BattleRoundStatus.IN_PROGRESS) return;

        const remaining = battle.participants.filter(
            (p) => !p.isEliminated,
        ).length;
        const target = Math.max(0, remaining - round.eliminateCount);

        const passedSubmissions = await this.prisma.battleRoundSubmission.findMany({
            where: { roundId, allPassed: true },
            select: { userId: true },
        });
        const distinctAllPassed = new Set(passedSubmissions.map((s) => s.userId));

        if (distinctAllPassed.size >= target && target > 0) {
            await this.endRoundAndAdvance(
                battleId,
                roundId,
                BattleRoundEndReason.EARLY_ALL_PASSED,
            );
        } else if (target === 0 && remaining === round.eliminateCount + 0) {
            // Degenerate: elim == 0 AND remaining == 0 — can't occur with config
            // validation, but be defensive.
        }
    }

    /**
     * SchedulerRegistry callback. If the round is still IN_PROGRESS, ends it
     * with reason = TIMER. Otherwise no-op (race-safe with early end).
     */
    async handleRoundTimer(battleId: string, roundNumber: number) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { rounds: true },
        });
        if (!battle) return;
        if (battle.status !== BattleStatus.IN_PROGRESS) return;

        const round = battle.rounds.find((r) => r.roundNumber === roundNumber);
        if (!round) return;
        if (round.status !== BattleRoundStatus.IN_PROGRESS) return;

        await this.endRoundAndAdvance(
            battleId,
            round.id,
            BattleRoundEndReason.TIMER,
        );
    }

    /**
     * Atomically:
     *  1. Rank remaining participants by format-specific rules
     *  2. Race-safely flip the round PENDING/IN_PROGRESS → COMPLETED using a
     *     conditional updateMany. If another concurrent call already flipped
     *     the round (early-end vs timer, or two simultaneous submissions both
     *     hitting the early-end threshold), this one bails out without
     *     double-eliminating or double-emitting events.
     *  3. Mark the bottom `eliminateCount` as eliminated with descending
     *     placements (first-eliminated-in-round gets the highest remaining
     *     placement number).
     *  4. Emit per-user elimination events, then the round_end event.
     *  5. Clear the round timer (if still pending).
     *  6. If <=1 remaining, finalize the battle. Else advance to next round.
     */
    async endRoundAndAdvance(
        battleId: string,
        roundId: string,
        reason: BattleRoundEndReason,
    ) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: { select: { id: true, username: true } },
                    },
                },
                rounds: { orderBy: { roundNumber: 'asc' } },
            },
        });
        if (!battle) return;
        const round = battle.rounds.find((r) => r.id === roundId);
        if (!round) return;
        // Cheap outer short-circuit; the real race-safety guard is the
        // conditional updateMany inside the transaction below.
        if (round.status === BattleRoundStatus.COMPLETED) return;

        const remainingParticipants = battle.participants.filter(
            (p) => !p.isEliminated,
        );
        const remainingCount = remainingParticipants.length;
        const eliminateN = Math.min(round.eliminateCount, remainingCount);

        // Gather submissions for ranking
        const submissions = await this.prisma.battleRoundSubmission.findMany({
            where: { roundId: round.id },
        });

        // Precompute cumulative points across the whole battle so far
        const cumulative = await this.computeCumulativePoints(battleId);

        const ranked = this.rankParticipantsForElimination(
            battle.battleRoyaleFormat!,
            remainingParticipants.map((p) => ({
                userId: p.userId,
                username: p.user.username,
            })),
            submissions,
            cumulative,
        );

        // Bottom `eliminateN` are eliminated. `toEliminate` is ordered
        // "best-of-the-cut" first → "worst-of-the-cut" last.
        const toEliminate = ranked.slice(ranked.length - eliminateN);
        // With `remainingCount` players left and `eliminateN` eliminated this
        // round, placements run from (remainingCount - eliminateN + 1) for
        // toEliminate[0] up to remainingCount for toEliminate[eliminateN-1].
        const placementBase = remainingCount;

        // Race-safe: only one concurrent caller wins the conditional flip.
        // The loser sees `count === 0` and bails out.
        const wonRace = await this.prisma.$transaction(async (tx) => {
            const flip = await tx.battleRound.updateMany({
                where: {
                    id: round.id,
                    status: { not: BattleRoundStatus.COMPLETED },
                },
                data: {
                    status: BattleRoundStatus.COMPLETED,
                    endedAt: new Date(),
                    endedReason: reason,
                },
            });
            if (flip.count === 0) {
                return false;
            }

            for (let i = 0; i < toEliminate.length; i++) {
                const entry = toEliminate[i];
                // `toEliminate` is ordered best-of-cut → worst-of-cut.
                // Placement for toEliminate[i]:
                //   toEliminate[0]           → remainingCount - eliminateN + 1
                //   toEliminate[eliminateN-1] → remainingCount
                const placement = placementBase - (eliminateN - 1 - i);
                await tx.battleParticipant.updateMany({
                    where: {
                        battleId,
                        userId: entry.userId,
                        isEliminated: false,
                    },
                    data: {
                        isEliminated: true,
                        placement,
                        eliminatedInRound: round.roundNumber,
                    },
                });
            }
            return true;
        });

        if (!wonRace) {
            // Another concurrent call already closed this round — do nothing
            // here; that caller is responsible for events and advancement.
            return;
        }

        // Emit per-user elimination events AFTER the atomic flip so they only
        // fire for the winning caller.
        const eliminatedUserIds: string[] = [];
        for (let i = 0; i < toEliminate.length; i++) {
            const entry = toEliminate[i];
            const placement = placementBase - (eliminateN - 1 - i);
            eliminatedUserIds.push(entry.userId);
            this.gateway.emitRoyaleElimination(battleId, {
                battleId,
                userId: entry.userId,
                roundNumber: round.roundNumber,
                placement,
            });
        }

        // Clear the timer (round ended early) — safe no-op if already fired.
        this.clearRoundTimer(battleId, round.roundNumber);

        // Broadcast round_end
        const standings = await this.getStandings(battleId);
        this.gateway.emitRoyaleRoundEnd(battleId, {
            battleId,
            roundNumber: round.roundNumber,
            endedReason: reason,
            eliminatedUserIds,
            standings,
        });

        // Advance or finalize
        const newRemaining = remainingCount - eliminateN;
        if (newRemaining <= 1) {
            await this.finalizeRoyale(battleId);
            return;
        }

        const nextRound = battle.rounds.find(
            (r) => r.roundNumber === round.roundNumber + 1,
        );
        if (!nextRound) {
            // Out of configured rounds with >1 alive — finalize anyway.
            await this.finalizeRoyale(battleId);
            return;
        }

        await this.prisma.battle.update({
            where: { id: battleId },
            data: { currentRound: nextRound.roundNumber },
        });
        await this.startRound(battleId, nextRound.roundNumber);
    }

    /**
     * Rank non-eliminated participants from BEST (safest) to WORST (first to
     * be eliminated) for the current round.
     *
     * SAME_PROBLEM — "v1 Balanced" bucket rules:
     *   Bucket A: full solve this round (allPassed === true)   [safest]
     *   Bucket B: attempted but not a full solve               [middle]
     *   Bucket C: no submission at all this round              [worst]
     *
     *   Buckets are compared A < B < C (A safest). Within each bucket we use
     *   a deterministic tie-break:
     *     A: earliest submittedAt asc → userId asc
     *        (first to fully solve is the safest — this makes "first to
     *        answer advances" natural for simple quick-round formats)
     *     B: testsPassed desc → earliest submittedAt asc → userId asc
     *        (more tests passing is safer; earlier submission breaks ties)
     *     C: userId asc (pure deterministic; there's no signal to rank on)
     *
     * SCORE_ATTACK: order by cumulativePoints desc → thisRoundPoints desc →
     *   lastSubmittedAt asc → userId asc.
     */
    private rankParticipantsForElimination(
        format: BattleRoyaleFormat,
        participants: Array<{ userId: string; username?: string }>,
        submissions: Array<{
            userId: string;
            allPassed: boolean;
            testsPassed: number;
            pointsEarned: number;
            submittedAt: Date;
        }>,
        cumulative: Map<string, { points: number; lastSubmittedAt: Date | null }>,
    ): Array<{ userId: string }> {
        if (format === BattleRoyaleFormat.SAME_PROBLEM) {
            // One submission per (round, user, problem) is the invariant
            // enforced by the submit handler (upsert on unique key). If that
            // invariant ever changes we still pick the best row per user:
            // prefer allPassed, then higher testsPassed, then earlier time.
            const bestByUser = new Map<
                string,
                {
                    allPassed: boolean;
                    testsPassed: number;
                    submittedAt: Date;
                }
            >();
            for (const s of submissions) {
                const cur = bestByUser.get(s.userId);
                if (
                    !cur ||
                    (s.allPassed && !cur.allPassed) ||
                    (s.allPassed === cur.allPassed &&
                        s.testsPassed > cur.testsPassed) ||
                    (s.allPassed === cur.allPassed &&
                        s.testsPassed === cur.testsPassed &&
                        s.submittedAt < cur.submittedAt)
                ) {
                    bestByUser.set(s.userId, {
                        allPassed: s.allPassed,
                        testsPassed: s.testsPassed,
                        submittedAt: s.submittedAt,
                    });
                }
            }

            // Classify each remaining participant into a bucket.
            type Bucket = 'A' | 'B' | 'C';
            const enriched = participants.map((p) => {
                const sub = bestByUser.get(p.userId) || null;
                let bucket: Bucket;
                if (!sub) bucket = 'C';
                else if (sub.allPassed) bucket = 'A';
                else bucket = 'B';
                return { userId: p.userId, sub, bucket };
            });

            enriched.sort((a, b) => {
                // Lower bucket letter ranks better (A < B < C).
                if (a.bucket !== b.bucket) {
                    return a.bucket < b.bucket ? -1 : 1;
                }
                if (a.bucket === 'A' && a.sub && b.sub) {
                    // Earliest full-pass wins. First to fully solve is safest.
                    const t =
                        a.sub.submittedAt.getTime() - b.sub.submittedAt.getTime();
                    if (t !== 0) return t;
                    return a.userId.localeCompare(b.userId);
                }
                if (a.bucket === 'B' && a.sub && b.sub) {
                    if (a.sub.testsPassed !== b.sub.testsPassed) {
                        return b.sub.testsPassed - a.sub.testsPassed;
                    }
                    const t =
                        a.sub.submittedAt.getTime() - b.sub.submittedAt.getTime();
                    if (t !== 0) return t;
                    return a.userId.localeCompare(b.userId);
                }
                // Bucket C (or defensive fallback): no submission signal.
                return a.userId.localeCompare(b.userId);
            });
            return enriched.map((e) => ({ userId: e.userId }));
        }

        // SCORE_ATTACK
        const roundPoints = new Map<string, number>();
        const lastSubmitted = new Map<string, Date>();
        for (const s of submissions) {
            roundPoints.set(
                s.userId,
                (roundPoints.get(s.userId) || 0) + s.pointsEarned,
            );
            const prev = lastSubmitted.get(s.userId);
            if (!prev || s.submittedAt > prev) {
                lastSubmitted.set(s.userId, s.submittedAt);
            }
        }
        const enriched = participants.map((p) => ({
            userId: p.userId,
            cum: cumulative.get(p.userId)?.points || 0,
            round: roundPoints.get(p.userId) || 0,
            last:
                lastSubmitted.get(p.userId) ||
                cumulative.get(p.userId)?.lastSubmittedAt ||
                null,
        }));
        enriched.sort((a, b) => {
            if (a.cum !== b.cum) return b.cum - a.cum;
            if (a.round !== b.round) return b.round - a.round;
            if (a.last && b.last) {
                const t = a.last.getTime() - b.last.getTime();
                if (t !== 0) return t;
            } else if (!!a.last !== !!b.last) {
                return a.last ? -1 : 1;
            }
            return a.userId.localeCompare(b.userId);
        });
        return enriched.map((e) => ({ userId: e.userId }));
    }

    private async computeCumulativePoints(battleId: string) {
        const subs = await this.prisma.battleRoundSubmission.findMany({
            where: { round: { battleId } },
            select: { userId: true, pointsEarned: true, submittedAt: true },
        });
        const map = new Map<
            string,
            { points: number; lastSubmittedAt: Date | null }
        >();
        for (const s of subs) {
            const cur = map.get(s.userId) || { points: 0, lastSubmittedAt: null };
            cur.points += s.pointsEarned;
            if (!cur.lastSubmittedAt || s.submittedAt > cur.lastSubmittedAt) {
                cur.lastSubmittedAt = s.submittedAt;
            }
            map.set(s.userId, cur);
        }
        return map;
    }

    // ========================================
    // Finalize
    // ========================================

    /**
     * Mark the winner (placement=1, isEliminated=false), flip the battle to
     * COMPLETED, apply pair-wise Elo, and emit battle.completed.
     */
    async finalizeRoyale(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: {
                            include: { clan: true },
                        },
                    },
                },
            },
        });
        if (!battle) return;
        if (battle.status === BattleStatus.COMPLETED) return;

        const alive = battle.participants.filter((p) => !p.isEliminated);
        const winner = alive[0] || null;

        await this.prisma.$transaction(async (tx) => {
            if (winner) {
                await tx.battleParticipant.update({
                    where: { id: winner.id },
                    data: { placement: 1, isEliminated: false },
                });
            }
            await tx.battle.update({
                where: { id: battleId },
                data: {
                    status: BattleStatus.COMPLETED,
                    winnerId: winner?.userId ?? null,
                    endedAt: new Date(),
                },
            });
        });

        // MMR
        await this.applyRoyaleMmr(battleId);

        // Broadcast battle.completed via the gateway
        const finalBattle = await this.getRoyaleDetails(battleId);
        this.gateway.emitBattleCompleted(battleId, finalBattle);
    }

    /**
     * Pair-wise Elo across every pair of participants using their final
     * placement. K=16, MMR floor 0, PRO/trial gating identical to 1v1.
     * Season peak and wins/losses are updated as well.
     */
    async applyRoyaleMmr(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!battle) return;

        // Compute final placements. Participants whose placement is null (shouldn't
        // happen post-finalize, but be defensive) are placed last in stable order.
        const participants = [...battle.participants].sort((a, b) => {
            const ap = a.placement ?? Number.MAX_SAFE_INTEGER;
            const bp = b.placement ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            return a.userId.localeCompare(b.userId);
        });

        const deltas = new Map<string, number>();
        for (const p of participants) deltas.set(p.userId, 0);

        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                const a = participants[i];
                const b = participants[j];
                const Ra = a.user.mmr;
                const Rb = b.user.mmr;
                const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
                // Placements: lower placement number = better finish.
                let Sa: number;
                if ((a.placement ?? 0) === (b.placement ?? 0)) Sa = 0.5;
                else Sa = (a.placement ?? 0) < (b.placement ?? 0) ? 1 : 0;
                const da = ELO_K_FACTOR * (Sa - Ea);
                deltas.set(a.userId, (deltas.get(a.userId) || 0) + da);
                deltas.set(b.userId, (deltas.get(b.userId) || 0) - da);
            }
        }

        // Apply deltas (rounded to int) with subscription gating + MMR floor.
        for (const p of participants) {
            const raw = deltas.get(p.userId) || 0;
            const change = Math.round(raw);

            const hasProAccess =
                p.user.subscriptionTier === 'PRO' ||
                (p.user.trialEndsAt &&
                    new Date(p.user.trialEndsAt) > new Date());

            // Record the change on the participant for history regardless of gate
            await this.prisma.battleParticipant.update({
                where: { id: p.id },
                data: { mmrChange: hasProAccess ? change : 0 },
            });

            if (hasProAccess) {
                const newMmr = Math.max(MIN_MMR, p.user.mmr + change);
                const isWinner = p.placement === 1;
                await this.prisma.user.update({
                    where: { id: p.userId },
                    data: {
                        mmr: newMmr,
                        wins: isWinner ? { increment: 1 } : undefined,
                        losses: !isWinner ? { increment: 1 } : undefined,
                    },
                });

                // Season updates (non-critical, best-effort)
                try {
                    await this.seasonsService.updatePeakMmr(p.userId, newMmr);
                    await this.seasonsService.incrementSeasonStats(
                        p.userId,
                        isWinner,
                    );
                } catch (err) {
                    this.logger.warn(
                        `Season update failed for ${p.userId}: ${(err as Error).message}`,
                    );
                }
            }
        }
    }

    // ========================================
    // Read models
    // ========================================

    /**
     * Return the current standings: ordered by (placement asc NULLS LAST,
     * cumulativePoints desc, lastSubmittedAt asc, userId asc).
     */
    async getStandings(battleId: string): Promise<StandingsEntry[]> {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                                mmr: true,
                            },
                        },
                    },
                },
                rounds: true,
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        const cumulative = await this.computeCumulativePoints(battleId);
        const currentRound = battle.rounds.find(
            (r) => r.status === BattleRoundStatus.IN_PROGRESS,
        );
        const roundSubmissions = currentRound
            ? await this.prisma.battleRoundSubmission.findMany({
                  where: { roundId: currentRound.id },
              })
            : [];
        const roundPoints = new Map<string, number>();
        for (const s of roundSubmissions) {
            roundPoints.set(
                s.userId,
                (roundPoints.get(s.userId) || 0) + s.pointsEarned,
            );
        }

        const entries: StandingsEntry[] = battle.participants.map((p) => {
            const cum = cumulative.get(p.userId) || {
                points: 0,
                lastSubmittedAt: null,
            };
            return {
                userId: p.userId,
                username: p.user.username,
                avatarUrl: p.user.avatarUrl,
                mmr: p.user.mmr,
                tier: getRankTier(p.user.mmr),
                isEliminated: p.isEliminated,
                placement: p.placement,
                eliminatedInRound: p.eliminatedInRound,
                cumulativePoints: cum.points,
                roundPoints: roundPoints.get(p.userId) || 0,
                testsPassed: p.testsPassed,
                totalTests: p.totalTests,
                lastSubmittedAt: cum.lastSubmittedAt,
            };
        });

        entries.sort((a, b) => {
            // Non-eliminated players rank above eliminated players. Among
            // non-eliminated, placement=1 (winner, if any) comes first, then
            // null placements (still alive). Among eliminated, order by
            // placement asc (placement 2 is better than placement 3 etc.).
            if (a.isEliminated !== b.isEliminated)
                return a.isEliminated ? 1 : -1;
            const ap = a.placement ?? Number.MAX_SAFE_INTEGER;
            const bp = b.placement ?? Number.MAX_SAFE_INTEGER;
            if (ap !== bp) return ap - bp;
            if (a.cumulativePoints !== b.cumulativePoints)
                return b.cumulativePoints - a.cumulativePoints;
            if (a.lastSubmittedAt && b.lastSubmittedAt) {
                const t =
                    a.lastSubmittedAt.getTime() - b.lastSubmittedAt.getTime();
                if (t !== 0) return t;
            } else if (!!a.lastSubmittedAt !== !!b.lastSubmittedAt) {
                return a.lastSubmittedAt ? -1 : 1;
            }
            return a.userId.localeCompare(b.userId);
        });

        return entries;
    }

    /**
     * Return details for a single round, including submissions. Because this
     * exposes every participant's raw code, access is restricted to users who
     * are participants of the battle.
     */
    async getRoundDetails(
        battleId: string,
        roundNumber: number,
        requestingUserId: string,
    ) {
        const participant = await this.prisma.battleParticipant.findUnique({
            where: {
                battleId_userId: { battleId, userId: requestingUserId },
            },
            select: { id: true },
        });
        if (!participant) {
            throw new ForbiddenException(
                'Only battle participants can view round details',
            );
        }
        const round = await this.prisma.battleRound.findUnique({
            where: { battleId_roundNumber: { battleId, roundNumber } },
            include: {
                submissions: true,
            },
        });
        if (!round) {
            throw new NotFoundException(
                `Round ${roundNumber} not found for battle ${battleId}`,
            );
        }
        return round;
    }

    /**
     * All rounds for a battle (config + runtime state).
     */
    async listRounds(battleId: string) {
        // Ensure battle exists for a clean 404
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            select: { id: true },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        return this.prisma.battleRound.findMany({
            where: { battleId },
            orderBy: { roundNumber: 'asc' },
        });
    }

    /**
     * Full BR battle details, including rounds and standings.
     */
    async getRoyaleDetails(battleId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatarUrl: true,
                                mmr: true,
                                clan: { select: { tag: true, name: true } },
                            },
                        },
                    },
                },
                rounds: { orderBy: { roundNumber: 'asc' } },
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                    },
                },
                problemPool: {
                    include: {
                        items: {
                            include: {
                                problem: {
                                    select: {
                                        id: true,
                                        title: true,
                                        difficulty: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        return {
            ...battle,
            participants: battle.participants.map((p) => ({
                ...p,
                user: {
                    ...p.user,
                    tier: getRankTier(p.user.mmr),
                },
            })),
        };
    }
}
