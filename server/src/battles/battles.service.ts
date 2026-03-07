import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { BattleMode, BattleStatus, Difficulty } from '@prisma/client';
import { CreateBattleDto } from './dto/create-battle.dto';

// K-factor for Elo calculation (higher = more volatile ratings)
const ELO_K_FACTOR = 32;
const CLAN_MMR_CHANGE = 15;

// Point values by difficulty
const DIFFICULTY_POINTS: Record<Difficulty, number> = {
    EASY: 2,
    MEDIUM: 5,
    HARD: 10,
};

export interface SubmissionResult {
    testsPassed: number;
    totalTests: number;
    allPassed: boolean;
    pointsAwarded: number;
    results: Array<{
        testCaseId: string;
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string | null;
        error: string | null;
    }>;
}

@Injectable()
export class BattlesService {
    constructor(
        private prisma: PrismaService,
        private codeExecutionService: CodeExecutionService,
    ) { }

    /**
     * Check if battle mode is a team mode
     */
    private isTeamMode(mode: BattleMode): boolean {
        return mode === BattleMode.CLAN_VS_CLAN || mode === BattleMode.GROUP;
    }

    /**
     * Create a new battle
     */
    async createBattle(userId: string, dto: CreateBattleDto) {
        const mode = dto.mode || BattleMode.ONE_V_ONE;
        const isTeam = this.isTeamMode(mode);

        // Validation based on mode
        if (!isTeam && !dto.problemId) {
            throw new BadRequestException(
                'problemId is required for 1v1 and battle royale modes',
            );
        }

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

        // For single-problem modes, verify problem exists
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
        }

        // Create battle
        const battle = await this.prisma.battle.create({
            data: {
                mode,
                problemId: dto.problemId || null,
                teamSize: isTeam ? dto.teamSize : null,
                timeLimitMinutes: dto.timeLimitMinutes || 5,
                autoBalance: dto.autoBalance ?? true,
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

    /**
     * Join an existing battle
     */
    async joinBattle(userId: string, battleId: string, preferredTeam?: string) {
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

        // Determine if battle should start
        const shouldStart = this.shouldStartBattle(
            battle.mode,
            battle.participants.length + 1,
            battle.teamSize,
        );

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
        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: {
                code,
                language,
                testsPassed: executionResult.passed,
                totalTests: executionResult.total,
                submittedAt: new Date(),
                pointsEarned: { increment: pointsAwarded },
            },
        });

        // For single-problem modes, check if all participants have submitted
        if (!isTeam) {
            const updatedBattle = await this.prisma.battle.findUnique({
                where: { id: battleId },
                include: { participants: true },
            });

            const allSubmitted = updatedBattle?.participants.every(
                (p) => p.submittedAt !== null,
            );

            if (allSubmitted) {
                await this.completeBattle(battleId);
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

                // Update user MMR and win/loss counters (only for non-team battles)
                if (!isTeam) {
                    await tx.user.update({
                        where: { id: participant.userId },
                        data: {
                            mmr: { increment: mmrChange },
                            wins: isWinner ? { increment: 1 } : undefined,
                            losses: !isWinner && winnerId ? { increment: 1 } : undefined,
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
                        data: { mmr: { increment: CLAN_MMR_CHANGE } },
                    });
                }
                if (losingParticipant?.user.clanId) {
                    await tx.clan.update({
                        where: { id: losingParticipant.user.clanId },
                        data: { mmr: { increment: -CLAN_MMR_CHANGE } },
                    });
                }
            }
        });

        // Return updated battle
        return this.getBattleDetails(battleId);
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
            },
        });

        if (!battle) {
            throw new NotFoundException(`Battle with ID ${battleId} not found`);
        }

        return battle;
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
            data: battles,
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
     * Get available (waiting) battles that a user can join
     */
    async getAvailableBattles(userId: string) {
        return this.prisma.battle.findMany({
            where: {
                status: BattleStatus.WAITING,
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
}
