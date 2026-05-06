import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import { BattleMode, BattleStatus, Difficulty, SkillType } from '@prisma/client';
import { CreateBattleDto } from './dto/create-battle.dto';
import { getRankTier } from '../common/utils/rank-tiers';
import { randomBytes } from 'crypto';
import { BattleRoyaleService } from './battle-royale.service';
import { ClanWarsService } from './clan-wars.service';
import {
    BATTLE_EVENTS_PORT,
    BattleEventsPort,
} from '../realtime/ports/battle-events.port';
import { SubmissionResult } from './types/battle-submission.types';

// K-factor for Elo calculation (higher = more volatile ratings)
const ELO_K_FACTOR = 16;
// Minimum MMR value (floor)
const MIN_MMR = 0;
const CLAN_MMR_CHANGE = 15;
const INVITE_CODE_LENGTH = 8;
const INVITE_EXPIRY_HOURS = 24;

// Stale battle cleanup tuning.
// Grace is added on top of timeLimitMinutes so legitimate end-of-match submits
// (the client Timer posts /complete on zero) have a window to land first.
const BATTLE_EXPIRY_GRACE_MS = 30_000; // 30s
// Public 1v1 lobbies without an invite code that nobody joined can stall the
// matchmaking guard forever. Keep the TTL short but forgiving enough to cover
// slow connections / friend invites that haven't been accepted.
const WAITING_PUBLIC_TTL_MS = 15 * 60 * 1000; // 15 minutes
// How often the global cleanup interval runs. Lightweight scans; keep it
// frequent enough that a user who abandons a battle can immediately requeue
// without waiting multiple minutes.
const STALE_BATTLE_SCAN_INTERVAL_MS = 30_000; // 30s

// Point values by difficulty
const DIFFICULTY_POINTS: Record<Difficulty, number> = {
    EASY: 2,
    MEDIUM: 5,
    HARD: 10,
};

@Injectable()
export class BattlesService {
    private readonly logger = new Logger(BattlesService.name);

    constructor(
        private prisma: PrismaService,
        private codeExecutionService: CodeExecutionService,
        private subscriptionsService: SubscriptionsService,
        private seasonsService: SeasonsService,
        private problemsService: ProblemsService,
        // BR/CW are same-module providers (BattlesModule); no forwardRef
        // needed because there's no TS-side cycle between them and us
        // anymore — all three only share types via `types/battle-submission`.
        private battleRoyaleService: BattleRoyaleService,
        private clanWarsService: ClanWarsService,
        @Inject(BATTLE_EVENTS_PORT)
        private gateway: BattleEventsPort,
    ) { }

    /**
     * Check if battle mode is a team mode
     */
    private isTeamMode(mode: BattleMode): boolean {
        return mode === BattleMode.CLAN_VS_CLAN || mode === BattleMode.GROUP;
    }

    /**
     * Generate a unique 8-character alphanumeric invite code (uppercase)
     */
    async generateInviteCode(): Promise<string> {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded ambiguous: I, O, 0, 1
        const maxAttempts = 10;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const bytes = randomBytes(INVITE_CODE_LENGTH);
            let code = '';
            for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
                code += chars[bytes[i] % chars.length];
            }

            // Check uniqueness against active (non-expired, non-completed) battles
            const existing = await this.prisma.battle.findFirst({
                where: {
                    inviteCode: code,
                    status: { not: BattleStatus.COMPLETED },
                },
            });
            if (!existing) {
                return code;
            }
        }

        throw new BadRequestException('Failed to generate unique invite code. Please try again.');
    }

    /**
     * Create a new battle
     */
    async createBattle(userId: string, dto: CreateBattleDto) {
        const mode = dto.mode || BattleMode.ONE_V_ONE;

        // Battle Royale: delegate to the dedicated service. It handles the
        // subscription gate, config validation, and round creation.
        if (mode === BattleMode.BATTLE_ROYALE) {
            return this.battleRoyaleService.createRoyaleBattle(userId, {
                ...dto,
                mode: BattleMode.BATTLE_ROYALE,
            });
        }

        // Check if user can play (subscription / daily limit)
        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }
        const isTeam = this.isTeamMode(mode);

        // Validation based on mode
        if (isTeam && !dto.teamSize) {
            throw new BadRequestException(
                'teamSize is required for team battle modes',
            );
        }

        // Verify user exists and get clan info
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { clan: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // For CLAN_VS_CLAN, user must be in a clan
        if (mode === BattleMode.CLAN_VS_CLAN && !user.clanId) {
            throw new BadRequestException(
                'You must be in a clan to create a clan battle',
            );
        }

        // Resolve problem: use provided problemId, or auto-select a random one
        let problem = null;
        if (dto.problemId) {
            problem = await this.prisma.problem.findUnique({
                where: { id: dto.problemId },
                include: { testCases: true },
            });

            if (!problem) {
                throw new NotFoundException(
                    `Problem with ID ${dto.problemId} not found`,
                );
            }
        } else if (!isTeam) {
            // Auto-select a random problem based on preferred difficulty and topic
            const difficulty = dto.preferredDifficulty
                ? (dto.preferredDifficulty as Difficulty)
                : undefined;
            const tags = dto.preferredTopic ? [dto.preferredTopic] : undefined;

            try {
                problem = await this.problemsService.findRandom(difficulty, tags);
            } catch {
                // Fallback: try without filters if filtered search found nothing
                try {
                    problem = await this.problemsService.findRandom();
                } catch {
                    throw new BadRequestException(
                        'No problems available. Please try again later.',
                    );
                }
            }

            if (problem) {
                dto.problemId = problem.id;
            }
        }

        // Generate invite code if requested
        let inviteCode: string | null = null;
        let inviteExpiresAt: Date | null = null;
        if (dto.withInviteCode) {
            inviteCode = await this.generateInviteCode();
            inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
        }

        // Get active season
        const activeSeason = await this.seasonsService.getActiveSeason();

        // Create battle
        const battle = await this.prisma.battle.create({
            data: {
                mode,
                problemId: dto.problemId || null,
                teamSize: isTeam ? dto.teamSize : null,
                timeLimitMinutes: dto.timeLimitMinutes || 5,
                autoBalance: dto.autoBalance ?? true,
                enabledSkills: dto.enabledSkills || [],
                inviteCode,
                inviteExpiresAt,
                seasonId: activeSeason?.id || null,
                status: BattleStatus.WAITING,
                participants: {
                    create: {
                        userId,
                        totalTests: problem?.testCases.length || 0,
                        teamId: isTeam ? 'team-1' : null,
                    },
                },
            },
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
                problem: problem
                    ? {
                        select: {
                            id: true,
                            title: true,
                            difficulty: true,
                        },
                    }
                    : false,
            },
        });

        // For team battles, create problem pool
        if (isTeam) {
            await this.createProblemPool(battle.id, dto.problemIds);
        }

        return this.getBattleDetails(battle.id);
    }

    /**
     * Create problem pool for team battles
     */
    private async createProblemPool(battleId: string, problemIds?: string[]) {
        // Get problems - either specified IDs or all problems
        const problems = await this.prisma.problem.findMany({
            where: problemIds?.length ? { id: { in: problemIds } } : {},
            select: { id: true, difficulty: true },
        });

        if (problems.length === 0) {
            throw new BadRequestException('No problems available for the pool');
        }

        // Create pool with items
        await this.prisma.problemPool.create({
            data: {
                battleId,
                items: {
                    create: problems.map((p) => ({
                        problemId: p.id,
                        pointValue: DIFFICULTY_POINTS[p.difficulty],
                    })),
                },
            },
        });
    }

    async createRematch(userId: string, battleId: string) {
        const original = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                problem: { include: { testCases: true } },
                problemPool: { include: { items: true } },
            },
        });

        if (!original) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (original.status !== BattleStatus.COMPLETED) {
            throw new BadRequestException('Only completed battles can be rematched');
        }
        if (
            original.mode === BattleMode.CLAN_WARS ||
            original.mode === BattleMode.BATTLE_ROYALE
        ) {
            throw new BadRequestException('This battle mode does not support rematches');
        }
        if (!original.participants.some((participant) => participant.userId === userId)) {
            throw new ForbiddenException('Only participants can request a rematch');
        }

        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }

        const activeSeason = await this.seasonsService.getActiveSeason();
        const rematch = await this.prisma.battle.create({
            data: {
                mode: original.mode,
                rematchOfBattleId: original.id,
                problemId: original.problemId,
                teamSize: original.teamSize,
                timeLimitMinutes: original.timeLimitMinutes,
                autoBalance: original.autoBalance,
                enabledSkills: original.enabledSkills,
                seasonId: activeSeason?.id ?? null,
                status: BattleStatus.WAITING,
                participants: {
                    create: original.participants.map((participant) => ({
                        userId: participant.userId,
                        teamId: participant.teamId,
                        totalTests:
                            original.problem?.testCases.length ??
                            original.problemPool?.items.length ??
                            0,
                    })),
                },
            },
        });

        if (original.problemPool) {
            await this.prisma.problemPool.create({
                data: {
                    battleId: rematch.id,
                    items: {
                        create: original.problemPool.items.map((item) => ({
                            problemId: item.problemId,
                            pointValue: item.pointValue,
                        })),
                    },
                },
            });
        }

        return this.getBattleDetails(rematch.id);
    }

    /**
     * Join an existing battle
     */
    async joinBattle(userId: string, battleId: string, preferredTeam?: string, viaInviteCode?: boolean) {
        // Check if user can play (subscription / daily limit)
        const canPlay = await this.subscriptionsService.canPlay(userId);
        if (!canPlay) {
            throw new ForbiddenException(
                'Daily free game limit reached. Upgrade to Pro for unlimited games.',
            );
        }

        // Get battle with participants
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: {
                    include: {
                        user: { select: { mmr: true, clanId: true } },
                    },
                },
                problem: {
                    include: { testCases: true },
                },
                problemPool: {
                    include: { items: true },
                },
            },
        });

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        // Check battle is still waiting for players
        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not accepting new players');
        }

        // Block direct joins to invite-code battles (must use joinByInviteCode)
        if (battle.inviteCode && !viaInviteCode) {
            throw new BadRequestException('This battle requires an invite code to join');
        }

        // Check user is not already in the battle
        const existingParticipant = battle.participants.find(
            (p) => p.userId === userId,
        );
        if (existingParticipant) {
            throw new BadRequestException('You are already in this battle');
        }

        // Verify user exists and get their info
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { clan: true },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const isTeam = this.isTeamMode(battle.mode);

        // Team mode specific validations
        if (battle.mode === BattleMode.CLAN_VS_CLAN) {
            if (!user.clanId) {
                throw new BadRequestException(
                    'You must be in a clan to join a clan battle',
                );
            }
        }

        // Capacity checks
        if (battle.mode === BattleMode.ONE_V_ONE && battle.participants.length >= 2) {
            throw new BadRequestException('Battle is already full');
        }

        if (isTeam && battle.teamSize) {
            const totalCapacity = battle.teamSize * 2;
            if (battle.participants.length >= totalCapacity) {
                throw new BadRequestException('Battle is already full');
            }
        }

        if (battle.mode === BattleMode.BATTLE_ROYALE) {
            this.battleRoyaleService.enforceRoyaleJoinCap(battle);
        }

        // Determine team assignment for team modes
        let teamId: string | null = null;
        if (isTeam && battle.teamSize) {
            teamId = this.assignTeam(
                battle.participants,
                user,
                battle.mode,
                battle.teamSize,
                battle.autoBalance,
                preferredTeam,
            );
        }

        // Determine if battle should start (invite battles never auto-start)
        const shouldStart = battle.inviteCode
            ? false
            : this.shouldStartBattle(
                battle.mode,
                battle.participants.length + 1,
                battle.teamSize,
            );

        // Increment daily game count for all participants when battle starts
        if (shouldStart) {
            for (const p of battle.participants) {
                await this.subscriptionsService.incrementGamesPlayed(p.userId);
            }
            await this.subscriptionsService.incrementGamesPlayed(userId);
        }

        // Add user as participant
        const totalTests = battle.problem?.testCases.length || 0;
        const updatedBattle = await this.prisma.battle.update({
            where: { id: battleId },
            data: {
                status: shouldStart ? BattleStatus.IN_PROGRESS : BattleStatus.WAITING,
                startedAt: shouldStart ? new Date() : undefined,
                participants: {
                    create: {
                        userId,
                        totalTests,
                        teamId,
                    },
                },
            },
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
                problem: battle.problem
                    ? {
                        select: {
                            id: true,
                            title: true,
                            difficulty: true,
                            starterCode: true,
                        },
                    }
                    : false,
                problemPool: {
                    include: {
                        items: {
                            include: {
                                problem: {
                                    select: { id: true, title: true, difficulty: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        return updatedBattle;
    }

    /**
     * Assign team to a new participant
     */
    private assignTeam(
        existingParticipants: Array<{ teamId: string | null; user: { mmr: number; clanId: string | null } }>,
        newUser: { mmr: number; clanId: string | null },
        mode: BattleMode,
        teamSize: number,
        autoBalance: boolean,
        preferredTeam?: string,
    ): string {
        const team1 = existingParticipants.filter((p) => p.teamId === 'team-1');
        const team2 = existingParticipants.filter((p) => p.teamId === 'team-2');

        // For CLAN_VS_CLAN, assign based on clan
        if (mode === BattleMode.CLAN_VS_CLAN) {
            // If team-1 has members, check if this user is in the same clan
            if (team1.length > 0) {
                const team1ClanId = team1[0].user.clanId;
                if (newUser.clanId === team1ClanId) {
                    if (team1.length < teamSize) return 'team-1';
                    throw new BadRequestException('Your clan team is already full');
                }
                // Different clan, assign to team-2
                if (team2.length < teamSize) return 'team-2';
                throw new BadRequestException('Opposing team is already full');
            }
            // First player, start team-1
            return 'team-1';
        }

        // For GROUP mode with manual team selection
        if (!autoBalance && preferredTeam) {
            const team = preferredTeam === 'team-1' ? team1 : team2;
            if (team.length < teamSize) return preferredTeam;
            throw new BadRequestException('Selected team is already full');
        }

        // Auto-balance by MMR: add to team with lower total MMR
        const team1Mmr = team1.reduce((sum, p) => sum + p.user.mmr, 0);
        const team2Mmr = team2.reduce((sum, p) => sum + p.user.mmr, 0);

        // Prefer team with fewer players first, then lower MMR
        if (team1.length < team2.length && team1.length < teamSize) return 'team-1';
        if (team2.length < team1.length && team2.length < teamSize) return 'team-2';
        if (team1.length < teamSize && team1Mmr <= team2Mmr) return 'team-1';
        if (team2.length < teamSize) return 'team-2';
        return 'team-1';
    }

    /**
     * Determine if battle should auto-start based on participant count
     */
    private shouldStartBattle(
        mode: BattleMode,
        participantCount: number,
        teamSize?: number | null,
    ): boolean {
        if (mode === BattleMode.ONE_V_ONE) {
            return participantCount === 2;
        }
        if (this.isTeamMode(mode) && teamSize) {
            // Start when both teams are full
            return participantCount === teamSize * 2;
        }
        // BATTLE_ROYALE doesn't auto-start (manual start by host)
        return false;
    }

    /**
     * Submit a solution for a battle
     */
    async submitSolution(
        battleId: string,
        userId: string,
        code: string,
        language: string,
        problemId?: string, // Required for team battles to specify which problem
    ): Promise<SubmissionResult> {
        // Get battle
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                problem: {
                    include: { testCases: true },
                },
                problemPool: {
                    include: {
                        items: {
                            include: {
                                problem: {
                                    include: { testCases: true },
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

        // Battle Royale: delegate to the dedicated service for round-aware
        // submission handling, upsert-best semantics, and round-end evaluation.
        if (battle.mode === BattleMode.BATTLE_ROYALE) {
            return this.battleRoyaleService.submitRoyaleRound(
                battleId,
                userId,
                code,
                language,
                problemId,
            );
        }

        // Check battle is in progress
        if (battle.status !== BattleStatus.IN_PROGRESS) {
            throw new BadRequestException('Battle is not in progress');
        }

        // Check user is a participant
        const participant = battle.participants.find((p) => p.userId === userId);
        if (!participant) {
            throw new ForbiddenException('You are not a participant in this battle');
        }

        // Determine which problem to submit against
        const isTeam = this.isTeamMode(battle.mode);
        let targetProblemId = battle.problemId;
        let pointValue = 0;

        if (isTeam) {
            if (!problemId) {
                throw new BadRequestException(
                    'problemId is required for team battle submissions',
                );
            }
            // Find problem in pool
            const poolItem = battle.problemPool?.items.find(
                (item) => item.problemId === problemId,
            );
            if (!poolItem) {
                throw new BadRequestException(
                    'Problem not found in battle pool',
                );
            }
            targetProblemId = problemId;
            pointValue = poolItem.pointValue;
        }

        if (!targetProblemId) {
            throw new BadRequestException('No problem specified for submission');
        }

        // Execute code against test cases
        const executionResult = await this.codeExecutionService.executeCode(
            targetProblemId,
            code,
            language,
        );

        // Calculate points awarded (only for team battles, only if all tests pass)
        const pointsAwarded =
            isTeam && executionResult.allPassed ? pointValue : 0;

        // Update participant with results
        const submittedAt = new Date();
        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: {
                code,
                language,
                testsPassed: executionResult.passed,
                totalTests: executionResult.total,
                submittedAt,
                pointsEarned: { increment: pointsAwarded },
            },
        });

        // Broadcast submission progress to every participant in the battle
        // room so opponents/teammates see live progress. This covers 1v1 and
        // team modes; BR and CW emit their own standings events elsewhere.
        const submittingUser = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { username: true },
        });
        this.gateway.emitBattleSubmission(battleId, {
            userId,
            username: submittingUser?.username ?? '',
            testsPassed: executionResult.passed,
            totalTests: executionResult.total,
            submittedAt,
        });

        // End-condition evaluation for single-problem (non-team) modes:
        //   1. If *this* submission passes all tests, the battle is decided
        //      immediately — fastest correct solution wins, regardless of
        //      whether the opponent has submitted yet.
        //   2. Otherwise, fall back to the legacy "all submitted" rule so a
        //      battle still resolves when both players submit partial
        //      solutions.
        // Team modes intentionally do NOT auto-complete here; they resolve
        // via the timer-triggered /complete call on the controller.
        if (!isTeam) {
            let shouldComplete = executionResult.allPassed;

            if (!shouldComplete) {
                const updatedBattle = await this.prisma.battle.findUnique({
                    where: { id: battleId },
                    include: { participants: true },
                });
                shouldComplete =
                    !!updatedBattle?.participants.length &&
                    updatedBattle.participants.every(
                        (p) => p.submittedAt !== null,
                    );
            }

            if (shouldComplete) {
                // Concurrent submissions / a timer-triggered /complete call
                // can race with us. `completeBattle` throws if the battle is
                // already COMPLETED — swallow that specific case so the
                // submitter still gets a clean response.
                try {
                    await this.completeBattle(battleId);
                } catch (err) {
                    if (!(err instanceof BadRequestException)) {
                        throw err;
                    }
                    this.logger.debug(
                        `completeBattle race on ${battleId}: ${(err as Error).message}`,
                    );
                }
            }
        }

        return {
            testsPassed: executionResult.passed,
            totalTests: executionResult.total,
            allPassed: executionResult.allPassed,
            pointsAwarded,
            results: executionResult.results.map((r) => ({
                testCaseId: r.testCaseId,
                passed: r.passed,
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                error: r.error,
            })),
        };
    }

    /**
     * Complete a battle - determine winner and update MMR
     */
    async completeBattle(battleId: string) {
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

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        if (battle.status === BattleStatus.COMPLETED) {
            throw new BadRequestException('Battle is already completed');
        }

        const isTeam = this.isTeamMode(battle.mode);

        // Determine winner based on mode
        let winnerId: string | null = null;
        let winningTeam: string | null = null;

        if (isTeam) {
            // Team battle: sum points per team
            const teamScores = this.calculateTeamScores(battle.participants);
            const team1Score = teamScores.get('team-1') || 0;
            const team2Score = teamScores.get('team-2') || 0;

            if (team1Score > team2Score) {
                winningTeam = 'team-1';
            } else if (team2Score > team1Score) {
                winningTeam = 'team-2';
            }
            // If equal, it's a draw (winningTeam stays null)
        } else {
            // Individual battle: determine winner by tests passed, then submission time
            const sortedParticipants = [...battle.participants].sort((a, b) => {
                // First by tests passed (descending)
                if (b.testsPassed !== a.testsPassed) {
                    return b.testsPassed - a.testsPassed;
                }
                // Then by submission time (ascending - earlier is better)
                if (a.submittedAt && b.submittedAt) {
                    return a.submittedAt.getTime() - b.submittedAt.getTime();
                }
                // If one hasn't submitted, they lose
                if (a.submittedAt && !b.submittedAt) return -1;
                if (!a.submittedAt && b.submittedAt) return 1;
                return 0;
            });

            if (sortedParticipants.length >= 2) {
                const first = sortedParticipants[0];
                const second = sortedParticipants[1];

                if (
                    first.testsPassed > second.testsPassed ||
                    (first.testsPassed === second.testsPassed &&
                        first.submittedAt &&
                        second.submittedAt &&
                        first.submittedAt < second.submittedAt)
                ) {
                    winnerId = first.userId;
                } else if (first.submittedAt && !second.submittedAt) {
                    winnerId = first.userId;
                }
            } else if (
                sortedParticipants.length === 1 &&
                sortedParticipants[0].submittedAt
            ) {
                winnerId = sortedParticipants[0].userId;
            }
        }

        // Calculate MMR changes (only for 1v1)
        const mmrChanges = this.calculateMmrChanges(battle.participants, winnerId);

        // Update battle and participants in a transaction
        await this.prisma.$transaction(async (tx) => {
            // Update battle status
            await tx.battle.update({
                where: { id: battleId },
                data: {
                    status: BattleStatus.COMPLETED,
                    winnerId,
                    winningTeam,
                    endedAt: new Date(),
                },
            });

            // Update each participant's MMR change and user stats
            for (const participant of battle.participants) {
                const mmrChange = mmrChanges.get(participant.userId) || 0;
                const isWinner = isTeam
                    ? participant.teamId === winningTeam
                    : participant.userId === winnerId;

                // Update participant record
                await tx.battleParticipant.update({
                    where: { id: participant.id },
                    data: { mmrChange },
                });

                // Ranked 1v1s always affect the user's visible MMR.
                if (!isTeam) {
                    const newMmr = Math.max(MIN_MMR, participant.user.mmr + mmrChange);
                    await tx.user.update({
                        where: { id: participant.userId },
                        data: {
                            mmr: newMmr,
                            ...(winnerId
                                ? {
                                      wins: isWinner
                                          ? { increment: 1 }
                                          : undefined,
                                      losses: !isWinner
                                          ? { increment: 1 }
                                          : undefined,
                                  }
                                : {}),
                        },
                    });
                }
            }

            // Update clan MMR for CLAN_VS_CLAN battles
            if (battle.mode === BattleMode.CLAN_VS_CLAN && winningTeam) {
                const winningParticipant = battle.participants.find(
                    (p) => p.teamId === winningTeam,
                );
                const losingParticipant = battle.participants.find(
                    (p) => p.teamId && p.teamId !== winningTeam,
                );

                if (winningParticipant?.user.clanId) {
                    await tx.clan.update({
                        where: { id: winningParticipant.user.clanId },
                        data: {
                            mmr: { increment: CLAN_MMR_CHANGE },
                            wins: { increment: 1 },
                        },
                    });
                }
                if (losingParticipant?.user.clanId) {
                    await tx.clan.update({
                        where: { id: losingParticipant.user.clanId },
                        data: {
                            mmr: { increment: -CLAN_MMR_CHANGE },
                            losses: { increment: 1 },
                        },
                    });
                }
            }
        });

        // Update season records (outside transaction — non-critical)
        if (!isTeam) {
            for (const participant of battle.participants) {
                const mmrChange = mmrChanges.get(participant.userId) || 0;
                const hasProAccess =
                    participant.user.subscriptionTier === 'PRO' ||
                    (participant.user.trialEndsAt && new Date(participant.user.trialEndsAt) > new Date());

                if (hasProAccess) {
                    const isWinner = participant.userId === winnerId;
                    const newMmr = Math.max(MIN_MMR, participant.user.mmr + mmrChange);

                    // Update peak MMR and final MMR
                    await this.seasonsService.updatePeakMmr(participant.userId, newMmr);

                    // Increment wins/losses if there was a winner
                    if (winnerId) {
                        await this.seasonsService.incrementSeasonStats(participant.userId, isWinner);
                    }
                }
            }
        }

        // Return updated battle and broadcast to the battle room so every
        // client (winner, loser, spectators) navigates to the results screen
        // without relying on the timer firing.
        const finalBattle = await this.getBattleDetails(battleId);
        try {
            this.gateway.emitBattleCompleted(battleId, finalBattle);
        } catch (err) {
            // Don't fail the whole completion path if the broadcast hiccups;
            // REST reads of the battle still reflect the COMPLETED state.
            this.logger.warn(
                `Failed to broadcast battle.completed for ${battleId}: ${(err as Error).message}`,
            );
        }
        return finalBattle;
    }

    /**
     * Calculate team scores from participants
     */
    private calculateTeamScores(
        participants: Array<{ teamId: string | null; pointsEarned: number }>,
    ): Map<string, number> {
        const scores = new Map<string, number>();

        for (const p of participants) {
            if (p.teamId) {
                const current = scores.get(p.teamId) || 0;
                scores.set(p.teamId, current + p.pointsEarned);
            }
        }

        return scores;
    }

    /**
     * Get battle details
     */
    async getBattleDetails(battleId: string) {
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
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        description: true,
                        starterCode: true,
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
                                        description: true,
                                        starterCode: true,
                                    },
                                },
                            },
                        },
                    },
                },
                skillUses: true,
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

    /**
     * Get battle history for a user
     */
    async getBattleHistory(
        userId: string,
        page: number = 1,
        limit: number = 20,
    ) {
        const skip = (page - 1) * limit;

        // Verify user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        const [battles, total] = await Promise.all([
            this.prisma.battle.findMany({
                where: {
                    participants: {
                        some: { userId },
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
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
                    problem: {
                        select: {
                            id: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
            }),
            this.prisma.battle.count({
                where: {
                    participants: {
                        some: { userId },
                    },
                },
            }),
        ]);

        return {
            data: battles.map((battle) => ({
                ...battle,
                participants: battle.participants.map((p) => ({
                    ...p,
                    user: {
                        ...p.user,
                        tier: getRankTier(p.user.mmr),
                    },
                })),
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Calculate MMR changes using Elo rating system
     */
    private calculateMmrChanges(
        participants: Array<{ userId: string; user: { mmr: number } }>,
        winnerId: string | null,
    ): Map<string, number> {
        const changes = new Map<string, number>();

        if (participants.length !== 2) {
            // For non-1v1 battles or incomplete battles, no MMR change
            participants.forEach((p) => changes.set(p.userId, 0));
            return changes;
        }

        const [player1, player2] = participants;
        const rating1 = player1.user.mmr;
        const rating2 = player2.user.mmr;

        // Calculate expected scores using Elo formula
        const expected1 = 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
        const expected2 = 1 / (1 + Math.pow(10, (rating1 - rating2) / 400));

        // Determine actual scores
        let score1: number;
        let score2: number;

        if (winnerId === null) {
            // Draw
            score1 = 0.5;
            score2 = 0.5;
        } else if (winnerId === player1.userId) {
            score1 = 1;
            score2 = 0;
        } else {
            score1 = 0;
            score2 = 1;
        }

        // Calculate MMR changes
        const change1 = Math.round(ELO_K_FACTOR * (score1 - expected1));
        const change2 = Math.round(ELO_K_FACTOR * (score2 - expected2));

        changes.set(player1.userId, change1);
        changes.set(player2.userId, change2);

        return changes;
    }

    /**
     * Use a skill against an opponent in a battle
     */
    async useSkill(
        battleId: string,
        userId: string,
        targetUserId: string,
        skillType: SkillType,
    ) {
        // Get battle with participants and existing skill uses
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                skillUses: true,
            },
        });

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        // Battle must be in progress
        if (battle.status !== BattleStatus.IN_PROGRESS) {
            throw new BadRequestException('Battle is not in progress');
        }

        // Skill must be enabled for this battle
        if (!battle.enabledSkills.includes(skillType)) {
            throw new BadRequestException(
                `Skill ${skillType} is not enabled for this battle`,
            );
        }

        // User must be a participant
        const userParticipant = battle.participants.find(
            (p) => p.userId === userId,
        );
        if (!userParticipant) {
            throw new ForbiddenException('You are not a participant in this battle');
        }

        // Target must be a participant
        const targetParticipant = battle.participants.find(
            (p) => p.userId === targetUserId,
        );
        if (!targetParticipant) {
            throw new BadRequestException('Target is not a participant in this battle');
        }

        // Cannot target yourself
        if (userId === targetUserId) {
            throw new BadRequestException('You cannot use a skill on yourself');
        }

        // Gate: TIME_STEAL unlocks after passing at least one test case
        if (
            skillType === SkillType.TIME_STEAL &&
            (userParticipant.testsPassed ?? 0) < 1
        ) {
            throw new ForbiddenException(
                'Time Steal unlocks after you pass at least one test case',
            );
        }

        // Each skill can only be used once per user per battle
        const alreadyUsed = battle.skillUses.find(
            (su) => su.userId === userId && su.skillType === skillType,
        );
        if (alreadyUsed) {
            throw new BadRequestException(
                `You have already used ${skillType} in this battle`,
            );
        }

        // TIME_STEAL: shift the battle's startedAt earlier so all remaining time
        // computations drop. Clamp so the target retains at least 10s.
        let updatedStartedAt: Date | undefined;
        if (skillType === SkillType.TIME_STEAL && battle.startedAt) {
            const TIME_STEAL_SECONDS = 300; // 5 minutes
            const MIN_REMAINING_SECONDS = 10;
            const now = Date.now();
            const totalMs = battle.timeLimitMinutes * 60 * 1000;
            const endMs = battle.startedAt.getTime() + totalMs;
            const remainingMs = Math.max(0, endMs - now);
            const maxStealMs = Math.max(
                0,
                remainingMs - MIN_REMAINING_SECONDS * 1000,
            );
            const stealMs = Math.min(TIME_STEAL_SECONDS * 1000, maxStealMs);

            if (stealMs > 0) {
                const newStartedAt = new Date(
                    battle.startedAt.getTime() - stealMs,
                );
                await this.prisma.battle.update({
                    where: { id: battleId },
                    data: { startedAt: newStartedAt },
                });
                updatedStartedAt = newStartedAt;
            }
        }

        // Record the skill use
        const skillUse = await this.prisma.battleSkillUse.create({
            data: {
                battleId,
                userId,
                targetUserId,
                skillType,
            },
        });

        return { ...skillUse, updatedStartedAt };
    }

    /**
     * Get available (waiting) battles that a user can join
     */
    async getAvailableBattles(userId: string) {
        return this.prisma.battle.findMany({
            where: {
                status: BattleStatus.WAITING,
                inviteCode: null, // Exclude invite-only battles from public list
                // Exclude battles the user is already in
                participants: {
                    none: { userId },
                },
            },
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
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }

    /**
     * Get battle details by invite code (case-insensitive)
     */
    async getByInviteCode(code: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { inviteCode: code.toUpperCase() },
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
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                    },
                },
            },
        });

        if (!battle) {
            throw new NotFoundException('Invalid invite code');
        }

        if (battle.inviteExpiresAt && battle.inviteExpiresAt < new Date()) {
            throw new BadRequestException('Invite code has expired');
        }

        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is no longer accepting players');
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

    /**
     * Join a battle via invite code (case-insensitive)
     */
    async joinByInviteCode(userId: string, code: string) {
        const battle = await this.getByInviteCode(code);
        return this.joinBattle(userId, battle.id, undefined, true);
    }

    /**
     * Mark a participant as ready. When all participants are ready, start the battle.
     * Returns the updated battle and whether the battle started.
     */
    async readyUp(battleId: string, userId: string) {
        // Preflight: Clan Wars has two distinct ready-up phases that share
        // `BattleParticipant.isReady` — lobby ready-up (WAITING) and
        // per-round intermission ready-up (IN_PROGRESS + isInIntermission).
        // Handle the intermission case before entering the WAITING-only tx
        // below so existing state checks continue to work for all other modes.
        const preflight = await this.prisma.battle.findUnique({
            where: { id: battleId },
            select: { mode: true, status: true, isInIntermission: true },
        });
        if (!preflight) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }
        if (
            preflight.mode === BattleMode.CLAN_WARS &&
            preflight.status === BattleStatus.IN_PROGRESS &&
            preflight.isInIntermission
        ) {
            const { allReady } = await this.clanWarsService.readyForNextRound(
                battleId,
                userId,
            );
            return {
                battle: await this.getBattleDetails(battleId),
                started: allReady,
            };
        }

        // Use a transaction to prevent race conditions when multiple players ready up simultaneously
        const { allReady, isRoyale, isClanWars } = await this.prisma.$transaction(async (tx) => {
            const battle = await tx.battle.findUnique({
                where: { id: battleId },
                include: {
                    participants: true,
                },
            });

            if (!battle) {
                throw new NotFoundException(`Battle with ID ${battleId} not found`);
            }

            if (battle.status !== BattleStatus.WAITING) {
                throw new BadRequestException('Battle is not in waiting state');
            }

            const participant = battle.participants.find((p) => p.userId === userId);
            if (!participant) {
                throw new ForbiddenException('You are not a participant in this battle');
            }

            if (participant.isReady) {
                throw new BadRequestException('You are already ready');
            }

            // Need at least 2 participants to ready up
            if (battle.participants.length < 2) {
                throw new BadRequestException('Not enough players to ready up');
            }

            // For Battle Royale, require full lobby before anyone can ready up so
            // the game always starts with maxPlayers exactly.
            const royale = battle.mode === BattleMode.BATTLE_ROYALE;
            if (royale && battle.maxPlayers && battle.participants.length < battle.maxPlayers) {
                throw new BadRequestException(
                    `Battle Royale lobby is not full (${battle.participants.length}/${battle.maxPlayers})`,
                );
            }

            // For Clan Wars, require both teams full (teamSize * 2 exactly) before
            // anyone can ready up — symmetric with BR's full-lobby gate.
            const clanWars = battle.mode === BattleMode.CLAN_WARS;
            if (clanWars) {
                const requiredLobby = (battle.teamSize ?? 0) * 2;
                if (requiredLobby <= 0) {
                    throw new BadRequestException('Clan Wars battle has invalid teamSize');
                }
                if (battle.participants.length < requiredLobby) {
                    throw new BadRequestException(
                        `Clan Wars lobby is not full (${battle.participants.length}/${requiredLobby})`,
                    );
                }
                // Additionally every team slot must be filled (the cap gate
                // above is necessary but the team split must also be balanced).
                const team1Count = battle.participants.filter((p) => p.teamId === 'team-1').length;
                const team2Count = battle.participants.filter((p) => p.teamId === 'team-2').length;
                if (team1Count !== battle.teamSize || team2Count !== battle.teamSize) {
                    throw new BadRequestException(
                        `Clan Wars teams unbalanced (team-1: ${team1Count}, team-2: ${team2Count}, required: ${battle.teamSize} each)`,
                    );
                }
            }

            // Mark this participant as ready
            await tx.battleParticipant.update({
                where: { id: participant.id },
                data: { isReady: true },
            });

            // Re-read participants INSIDE the tx so two concurrent readying
            // players don't both see a stale "other not ready" snapshot and
            // both decline to start the battle (which would hang the lobby).
            const freshParticipants = await tx.battleParticipant.findMany({
                where: { battleId },
                select: { userId: true, isReady: true },
            });
            const otherReady = freshParticipants.every((p) => p.isReady);

            if (otherReady && !royale && !clanWars) {
                // Increment daily game counts for all participants (BR + CW
                // do this inside their respective start methods to keep each
                // mode's start path self-contained).
                for (const p of battle.participants) {
                    await this.subscriptionsService.incrementGamesPlayed(p.userId);
                }

                // Start the battle
                await tx.battle.update({
                    where: { id: battleId },
                    data: {
                        status: BattleStatus.IN_PROGRESS,
                        startedAt: new Date(),
                    },
                });
            }

            return { allReady: otherReady, isRoyale: royale, isClanWars: clanWars };
        });

        // Start BR / CW outside the tx since they themselves persist a bunch of
        // state, schedule timers, and emit websocket events.
        if (allReady && isRoyale) {
            await this.battleRoyaleService.startRoyale(battleId);
        } else if (allReady && isClanWars) {
            await this.clanWarsService.startClanWars(battleId);
        }

        return {
            battle: await this.getBattleDetails(battleId),
            started: allReady,
        };
    }

    /**
     * Unready a participant (toggle ready state off)
     */
    async unready(battleId: string, userId: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        // Clan Wars intermission: delegate to the clan-wars service so the
        // unready propagates through the same race-safe flip path.
        if (
            battle.mode === BattleMode.CLAN_WARS &&
            battle.status === BattleStatus.IN_PROGRESS &&
            battle.isInIntermission
        ) {
            await this.clanWarsService.unreadyForNextRound(battleId, userId);
            return this.getBattleDetails(battleId);
        }

        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not in waiting state');
        }

        const participant = battle.participants.find((p) => p.userId === userId);
        if (!participant) {
            throw new ForbiddenException('You are not a participant in this battle');
        }

        if (!participant.isReady) {
            throw new BadRequestException('You are not currently ready');
        }

        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: { isReady: false },
        });

        return this.getBattleDetails(battleId);
    }

    /**
     * Send an in-app invite to a user by username
     */
    async inviteUserToBattle(battleId: string, inviterUserId: string, targetUsername: string) {
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: { participants: true },
        });

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        if (battle.status !== BattleStatus.WAITING) {
            throw new BadRequestException('Battle is not accepting players');
        }

        // Verify inviter is a participant
        const inviterParticipant = battle.participants.find(
            (p) => p.userId === inviterUserId,
        );
        if (!inviterParticipant) {
            throw new ForbiddenException('You are not a participant in this battle');
        }

        // Find target user
        const targetUser = await this.prisma.user.findUnique({
            where: { username: targetUsername },
        });
        if (!targetUser) {
            throw new NotFoundException(`User "${targetUsername}" not found`);
        }

        // Check target is not already in the battle
        const targetInBattle = battle.participants.find(
            (p) => p.userId === targetUser.id,
        );
        if (targetInBattle) {
            throw new BadRequestException('User is already in this battle');
        }

        // Get inviter info for the notification
        const inviter = await this.prisma.user.findUnique({
            where: { id: inviterUserId },
            select: { username: true, avatarUrl: true },
        });

        return {
            targetUserId: targetUser.id,
            battleId,
            inviterUsername: inviter?.username,
            inviterAvatarUrl: inviter?.avatarUrl,
            battleMode: battle.mode,
            inviteCode: battle.inviteCode,
        };
    }

    // ==========================================
    // Stale battle cleanup
    // ==========================================
    //
    // Battle completion is normally driven by the client: the battle page Timer
    // calls POST /battles/:id/complete when the clock hits zero, and
    // submitSolution auto-completes the battle when a 1v1 participant passes
    // every test. When every player closes the tab (crash, lost tab, refused
    // paywall, etc.) neither of those fires, the battle rots in IN_PROGRESS,
    // and matchmaking's "already in an active battle" guard blocks the user
    // from ever queueing again. The helpers below make the server authoritative
    // about ending timed-out battles so the guard stops firing on stale rows.

    /**
     * Find IN_PROGRESS battles whose time limit (plus a small grace window)
     * has already elapsed. We include `timeLimitMinutes` in the projection so
     * callers can recompute the deadline precisely — Prisma can't compare two
     * columns + an arithmetic offset in a WHERE clause directly.
     */
    private async findExpiredInProgressBattles(
        filter: { userId?: string } = {},
    ): Promise<Array<{ id: string; startedAt: Date; timeLimitMinutes: number }>> {
        const candidates = await this.prisma.battle.findMany({
            where: {
                status: BattleStatus.IN_PROGRESS,
                startedAt: { not: null },
                ...(filter.userId
                    ? { participants: { some: { userId: filter.userId } } }
                    : {}),
            },
            select: {
                id: true,
                startedAt: true,
                timeLimitMinutes: true,
            },
        });

        const now = Date.now();
        return candidates
            .filter((b): b is { id: string; startedAt: Date; timeLimitMinutes: number } =>
                b.startedAt !== null,
            )
            .filter((b) => {
                const deadline =
                    b.startedAt.getTime() +
                    b.timeLimitMinutes * 60_000 +
                    BATTLE_EXPIRY_GRACE_MS;
                return deadline < now;
            });
    }

    /**
     * Find WAITING lobbies that should no longer block matchmaking:
     *   - Public 1v1 lobbies (no invite code) older than WAITING_PUBLIC_TTL_MS
     *   - Any invite lobby whose inviteExpiresAt has passed
     * Team/BR/clan lobbies are left alone — they're host-managed and their
     * lifecycle isn't a matchmaking concern.
     */
    private async findStaleWaitingBattles(
        filter: { userId?: string } = {},
    ): Promise<Array<{ id: string }>> {
        const now = new Date();
        const publicCutoff = new Date(now.getTime() - WAITING_PUBLIC_TTL_MS);

        const userScope = filter.userId
            ? { participants: { some: { userId: filter.userId } } }
            : {};

        return this.prisma.battle.findMany({
            where: {
                status: BattleStatus.WAITING,
                AND: [
                    userScope,
                    {
                        OR: [
                            {
                                mode: BattleMode.ONE_V_ONE,
                                inviteCode: null,
                                createdAt: { lt: publicCutoff },
                            },
                            {
                                inviteCode: { not: null },
                                inviteExpiresAt: { not: null, lt: now },
                            },
                        ],
                    },
                ],
            },
            select: { id: true },
        });
    }

    /**
     * Reuse completeBattle so winner/MMR/history/websocket semantics stay
     * centralized. For battles with zero submissions this gracefully resolves
     * to a null winner and no MMR movement (see calculateMmrChanges and the
     * winnerId branch in completeBattle). Races with a live client finishing
     * the battle first are expected — swallow the "already completed" error.
     */
    private async finalizeBattleSafely(battleId: string): Promise<boolean> {
        try {
            await this.completeBattle(battleId);
            return true;
        } catch (error) {
            const message = (error as Error).message ?? '';
            if (message.includes('already completed')) {
                return false;
            }
            this.logger.warn(
                `Failed to finalize stale battle ${battleId}: ${message}`,
            );
            return false;
        }
    }

    /**
     * Targeted cleanup: finalize/expire any stale active battles for this
     * specific user. Called synchronously from matchmaking before the active
     * battle guard fires so an abandoned lobby doesn't block a fresh queue.
     * Returns the number of battles that were transitioned.
     */
    async finalizeStaleBattlesForUser(userId: string): Promise<number> {
        let changed = 0;

        const expired = await this.findExpiredInProgressBattles({ userId });
        for (const battle of expired) {
            if (await this.finalizeBattleSafely(battle.id)) {
                changed += 1;
                this.logger.log(
                    `Finalized stale IN_PROGRESS battle ${battle.id} for user ${userId}`,
                );
            }
        }

        const stale = await this.findStaleWaitingBattles({ userId });
        for (const battle of stale) {
            if (await this.finalizeBattleSafely(battle.id)) {
                changed += 1;
                this.logger.log(
                    `Expired stale WAITING battle ${battle.id} for user ${userId}`,
                );
            }
        }

        return changed;
    }

    /**
     * Global cleanup sweep. Runs on an interval so stale battles don't linger
     * indefinitely even for users who never try to requeue.
     */
    @Interval(STALE_BATTLE_SCAN_INTERVAL_MS)
    async cleanupStaleBattles() {
        try {
            const expired = await this.findExpiredInProgressBattles();
            for (const battle of expired) {
                await this.finalizeBattleSafely(battle.id);
            }

            const stale = await this.findStaleWaitingBattles();
            for (const battle of stale) {
                await this.finalizeBattleSafely(battle.id);
            }

            if (expired.length > 0 || stale.length > 0) {
                this.logger.log(
                    `Stale battle sweep finalized ${expired.length} in-progress and ${stale.length} waiting battle(s)`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Stale battle cleanup failed: ${(error as Error).message}`,
            );
        }
    }
}
