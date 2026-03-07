import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { BattleMode, BattleStatus } from '@prisma/client';

// K-factor for Elo calculation (higher = more volatile ratings)
const ELO_K_FACTOR = 32;

export interface SubmissionResult {
    testsPassed: number;
    totalTests: number;
    allPassed: boolean;
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
     * Create a new battle
     */
    async createBattle(
        userId: string,
        problemId: string,
        mode: BattleMode = BattleMode.ONE_V_ONE,
    ) {
        // Verify problem exists
        const problem = await this.prisma.problem.findUnique({
            where: { id: problemId },
            include: { testCases: true },
        });

        if (!problem) {
            throw new NotFoundException(`Problem with ID ${problemId} not found`);
        }

        // Verify user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Create battle with the creator as first participant
        const battle = await this.prisma.battle.create({
            data: {
                problemId,
                mode,
                status: BattleStatus.WAITING,
                participants: {
                    create: {
                        userId,
                        totalTests: problem.testCases.length,
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

        return battle;
    }

    /**
     * Join an existing battle
     */
    async joinBattle(userId: string, battleId: string) {
        // Get battle with participants
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                problem: {
                    include: { testCases: true },
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

        // For 1v1, max 2 participants
        if (
            battle.mode === BattleMode.ONE_V_ONE &&
            battle.participants.length >= 2
        ) {
            throw new BadRequestException('Battle is already full');
        }

        // Verify user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }

        // Add user as participant and start battle if full (for 1v1)
        const shouldStart =
            battle.mode === BattleMode.ONE_V_ONE &&
            battle.participants.length === 1;

        const updatedBattle = await this.prisma.battle.update({
            where: { id: battleId },
            data: {
                status: shouldStart ? BattleStatus.IN_PROGRESS : BattleStatus.WAITING,
                startedAt: shouldStart ? new Date() : undefined,
                participants: {
                    create: {
                        userId,
                        totalTests: battle.problem.testCases.length,
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
                            },
                        },
                    },
                },
                problem: {
                    select: {
                        id: true,
                        title: true,
                        difficulty: true,
                        starterCode: true,
                    },
                },
            },
        });

        return updatedBattle;
    }

    /**
     * Submit a solution for a battle
     */
    async submitSolution(
        battleId: string,
        userId: string,
        code: string,
        language: string,
    ): Promise<SubmissionResult> {
        // Get battle
        const battle = await this.prisma.battle.findUnique({
            where: { id: battleId },
            include: {
                participants: true,
                problem: {
                    include: { testCases: true },
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

        // Execute code against test cases
        const executionResult = await this.codeExecutionService.executeCode(
            battle.problemId,
            code,
            language,
        );

        // Update participant with results
        await this.prisma.battleParticipant.update({
            where: { id: participant.id },
            data: {
                code,
                language,
                testsPassed: executionResult.passed,
                totalTests: executionResult.total,
                submittedAt: new Date(),
            },
        });

        // Check if all participants have submitted and auto-complete if so
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

        return {
            testsPassed: executionResult.passed,
            totalTests: executionResult.total,
            allPassed: executionResult.allPassed,
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
                        user: true,
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

        // Determine winner based on tests passed, then submission time
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

        // Determine winner (null if tie with same tests passed and both didn't submit)
        let winnerId: string | null = null;
        if (sortedParticipants.length >= 2) {
            const first = sortedParticipants[0];
            const second = sortedParticipants[1];

            // Winner if they have more tests OR (same tests but submitted first)
            if (
                first.testsPassed > second.testsPassed ||
                (first.testsPassed === second.testsPassed &&
                    first.submittedAt &&
                    second.submittedAt &&
                    first.submittedAt < second.submittedAt)
            ) {
                winnerId = first.userId;
            } else if (first.submittedAt && !second.submittedAt) {
                // Only first submitted
                winnerId = first.userId;
            }
            // If same tests and time (or both didn't submit), it's a draw - winnerId stays null
        } else if (sortedParticipants.length === 1 && sortedParticipants[0].submittedAt) {
            // Single player who submitted wins by default
            winnerId = sortedParticipants[0].userId;
        }

        // Calculate MMR changes
        const mmrChanges = this.calculateMmrChanges(battle.participants, winnerId);

        // Update battle and participants in a transaction
        await this.prisma.$transaction(async (tx) => {
            // Update battle status
            await tx.battle.update({
                where: { id: battleId },
                data: {
                    status: BattleStatus.COMPLETED,
                    winnerId,
                    endedAt: new Date(),
                },
            });

            // Update each participant's MMR change and user stats
            for (const participant of battle.participants) {
                const mmrChange = mmrChanges.get(participant.userId) || 0;
                const isWinner = participant.userId === winnerId;

                // Update participant record
                await tx.battleParticipant.update({
                    where: { id: participant.id },
                    data: { mmrChange },
                });

                // Update user MMR and win/loss counters
                await tx.user.update({
                    where: { id: participant.userId },
                    data: {
                        mmr: { increment: mmrChange },
                        wins: isWinner ? { increment: 1 } : undefined,
                        losses: !isWinner && winnerId ? { increment: 1 } : undefined,
                    },
                });
            }
        });

        // Return updated battle
        return this.getBattleDetails(battleId);
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
