import { Test, TestingModule } from '@nestjs/testing';
import { BattlesService } from './battles.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { BattleMode, BattleStatus, Difficulty } from '@prisma/client';

describe('BattlesService', () => {
    let service: BattlesService;
    let prisma: MockPrismaService;
    let codeExecutionService: jest.Mocked<CodeExecutionService>;

    // Mock data
    const mockUser1 = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1000,
        wins: 5,
        losses: 3,
        role: 'user',
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUser2 = {
        id: 'user-2',
        username: 'bob',
        email: 'bob@test.com',
        avatarUrl: null,
        mmr: 1100,
        wins: 8,
        losses: 2,
        role: 'user',
        clanId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockProblem = {
        id: 'problem-1',
        title: 'Two Sum',
        description: 'Find two numbers',
        difficulty: Difficulty.EASY,
        starterCode: '{}',
        testCases: [
            {
                id: 'test-1',
                input: '[2,7,11,15]\n9',
                expectedOutput: '[0,1]',
                isHidden: false,
                problemId: 'problem-1',
            },
            {
                id: 'test-2',
                input: '[3,2,4]\n6',
                expectedOutput: '[1,2]',
                isHidden: true,
                problemId: 'problem-1',
            },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockBattle = {
        id: 'battle-1',
        mode: BattleMode.ONE_V_ONE,
        problemId: 'problem-1',
        winnerId: null,
        status: BattleStatus.WAITING,
        startedAt: null,
        endedAt: null,
        createdAt: new Date(),
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const mockCodeExecutionService = {
            executeCode: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BattlesService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: CodeExecutionService,
                    useValue: mockCodeExecutionService,
                },
            ],
        }).compile();

        service = module.get<BattlesService>(BattlesService);
        prisma = module.get<MockPrismaService>(PrismaService);
        codeExecutionService = module.get(CodeExecutionService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createBattle', () => {
        it('should create a battle with the creator as first participant', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const createdBattle = {
                ...mockBattle,
                participants: [
                    {
                        id: 'participant-1',
                        battleId: 'battle-1',
                        userId: mockUser1.id,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        submittedAt: null,
                        mmrChange: null,
                        user: mockUser1,
                    },
                ],
                problem: {
                    id: mockProblem.id,
                    title: mockProblem.title,
                    difficulty: mockProblem.difficulty,
                },
            };

            prisma.battle.create.mockResolvedValue(createdBattle);

            const result = await service.createBattle(
                mockUser1.id,
                mockProblem.id,
                BattleMode.ONE_V_ONE,
            );

            expect(prisma.problem.findUnique).toHaveBeenCalledWith({
                where: { id: mockProblem.id },
                include: { testCases: true },
            });
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: mockUser1.id },
            });
            expect(prisma.battle.create).toHaveBeenCalled();
            expect(result.participants).toHaveLength(1);
            expect(result.status).toBe(BattleStatus.WAITING);
        });

        it('should throw NotFoundException if problem does not exist', async () => {
            prisma.problem.findUnique.mockResolvedValue(null);

            await expect(
                service.createBattle(mockUser1.id, 'nonexistent', BattleMode.ONE_V_ONE),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException if user does not exist', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.createBattle('nonexistent', mockProblem.id, BattleMode.ONE_V_ONE),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('joinBattle', () => {
        it('should allow a user to join a waiting battle', async () => {
            const battleWithOneParticipant = {
                ...mockBattle,
                participants: [
                    {
                        id: 'participant-1',
                        battleId: 'battle-1',
                        userId: mockUser1.id,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        submittedAt: null,
                        mmrChange: null,
                    },
                ],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(battleWithOneParticipant);
            prisma.user.findUnique.mockResolvedValue(mockUser2);

            const updatedBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date(),
                participants: [
                    {
                        ...battleWithOneParticipant.participants[0],
                        user: mockUser1,
                    },
                    {
                        id: 'participant-2',
                        battleId: 'battle-1',
                        userId: mockUser2.id,
                        user: mockUser2,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        submittedAt: null,
                        mmrChange: null,
                    },
                ],
                problem: {
                    id: mockProblem.id,
                    title: mockProblem.title,
                    difficulty: mockProblem.difficulty,
                    starterCode: mockProblem.starterCode,
                },
            };

            prisma.battle.update.mockResolvedValue(updatedBattle);

            const result = await service.joinBattle(mockUser2.id, mockBattle.id);

            expect(result.status).toBe(BattleStatus.IN_PROGRESS);
            expect(result.participants).toHaveLength(2);
            expect(result.startedAt).toBeDefined();
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(
                service.joinBattle(mockUser2.id, 'nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if battle is not waiting', async () => {
            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(inProgressBattle);

            await expect(
                service.joinBattle(mockUser2.id, mockBattle.id),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if user is already in battle', async () => {
            const battleWithUser = {
                ...mockBattle,
                participants: [
                    {
                        id: 'participant-1',
                        userId: mockUser1.id,
                    },
                ],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(battleWithUser);

            await expect(
                service.joinBattle(mockUser1.id, mockBattle.id),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException if 1v1 battle is full', async () => {
            const fullBattle = {
                ...mockBattle,
                participants: [
                    { id: 'p1', userId: 'user-a' },
                    { id: 'p2', userId: 'user-b' },
                ],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(fullBattle);

            await expect(
                service.joinBattle(mockUser1.id, mockBattle.id),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('submitSolution', () => {
        const mockParticipant = {
            id: 'participant-1',
            battleId: 'battle-1',
            userId: mockUser1.id,
            code: null,
            language: null,
            testsPassed: 0,
            totalTests: 2,
            submittedAt: null,
            mmrChange: null,
        };

        it('should submit and evaluate a solution', async () => {
            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant],
                problem: mockProblem,
            };

            const battleAfterSubmission = {
                ...inProgressBattle,
                participants: [{ ...mockParticipant, submittedAt: new Date() }],
            };

            const completedBattle = {
                ...mockBattle,
                status: BattleStatus.COMPLETED,
                winnerId: mockUser1.id,
                participants: [
                    {
                        ...mockParticipant,
                        submittedAt: new Date(),
                        testsPassed: 2,
                        user: mockUser1,
                    },
                ],
            };

            // First call: initial fetch in submitSolution
            // Second call: fetch after participant update
            // Third call: fetch in completeBattle
            // Fourth call: fetch in getBattleDetails (at end of completeBattle)
            prisma.battle.findUnique
                .mockResolvedValueOnce(inProgressBattle)
                .mockResolvedValueOnce(battleAfterSubmission) // Only one participant, so won't trigger completeBattle
                .mockResolvedValueOnce(completedBattle);

            // Change mock to have only one participant who hasn't submitted yet
            // so completeBattle isn't auto-triggered
            const singleParticipantBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant],
                problem: mockProblem,
            };

            const afterSubmitSingleParticipant = {
                ...singleParticipantBattle,
                participants: [
                    { ...mockParticipant, submittedAt: new Date() },
                    { ...mockParticipant, id: 'p2', userId: 'user-2', submittedAt: null }, // Second participant hasn't submitted
                ],
            };

            // Reset and re-mock
            prisma.battle.findUnique.mockReset();
            prisma.battle.findUnique
                .mockResolvedValueOnce(singleParticipantBattle)
                .mockResolvedValueOnce(afterSubmitSingleParticipant);

            codeExecutionService.executeCode.mockResolvedValue({
                passed: 2,
                total: 2,
                allPassed: true,
                results: [
                    {
                        testCaseId: 'test-1',
                        passed: true,
                        input: '[2,7,11,15]\n9',
                        expectedOutput: '[0,1]',
                        actualOutput: '[0,1]',
                        error: null,
                        executionTime: '0.05s',
                    },
                    {
                        testCaseId: 'test-2',
                        passed: true,
                        input: '[Hidden]',
                        expectedOutput: '[Hidden]',
                        actualOutput: '[Hidden]',
                        error: null,
                        executionTime: '0.04s',
                    },
                ],
            });

            prisma.battleParticipant.update.mockResolvedValue({
                ...mockParticipant,
                code: 'function twoSum() {}',
                language: 'javascript',
                testsPassed: 2,
                submittedAt: new Date(),
            });

            const result = await service.submitSolution(
                mockBattle.id,
                mockUser1.id,
                'function twoSum() {}',
                'javascript',
            );

            expect(result.testsPassed).toBe(2);
            expect(result.totalTests).toBe(2);
            expect(result.allPassed).toBe(true);
            expect(codeExecutionService.executeCode).toHaveBeenCalledWith(
                mockProblem.id,
                'function twoSum() {}',
                'javascript',
            );
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(
                service.submitSolution(
                    'nonexistent',
                    mockUser1.id,
                    'code',
                    'javascript',
                ),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if battle is not in progress', async () => {
            const waitingBattle = {
                ...mockBattle,
                status: BattleStatus.WAITING,
                participants: [mockParticipant],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(waitingBattle);

            await expect(
                service.submitSolution(
                    mockBattle.id,
                    mockUser1.id,
                    'code',
                    'javascript',
                ),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if user is not a participant', async () => {
            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant],
                problem: mockProblem,
            };

            prisma.battle.findUnique.mockResolvedValue(inProgressBattle);

            await expect(
                service.submitSolution(
                    mockBattle.id,
                    'other-user',
                    'code',
                    'javascript',
                ),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('completeBattle', () => {
        it('should determine winner by tests passed', async () => {
            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        user: mockUser1,
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        user: mockUser2,
                        testsPassed: 1,
                        totalTests: 2,
                        submittedAt: new Date('2024-01-01T10:00:03'),
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithSubmissions)
                .mockResolvedValueOnce({
                    ...battleWithSubmissions,
                    status: BattleStatus.COMPLETED,
                    winnerId: mockUser1.id,
                });

            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(prisma);
            });

            const result = await service.completeBattle(mockBattle.id);

            expect(result.winnerId).toBe(mockUser1.id);
            expect(result.status).toBe(BattleStatus.COMPLETED);
        });

        it('should use submission time as tiebreaker', async () => {
            const battleWithTie = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        user: mockUser1,
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date('2024-01-01T10:00:10'), // Submitted later
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        user: mockUser2,
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date('2024-01-01T10:00:05'), // Submitted earlier - wins
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithTie)
                .mockResolvedValueOnce({
                    ...battleWithTie,
                    status: BattleStatus.COMPLETED,
                    winnerId: mockUser2.id,
                });

            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(prisma);
            });

            const result = await service.completeBattle(mockBattle.id);

            expect(result.winnerId).toBe(mockUser2.id);
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(service.completeBattle('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw BadRequestException if battle is already completed', async () => {
            const completedBattle = {
                ...mockBattle,
                status: BattleStatus.COMPLETED,
                participants: [],
            };

            prisma.battle.findUnique.mockResolvedValue(completedBattle);

            await expect(service.completeBattle(mockBattle.id)).rejects.toThrow(
                BadRequestException,
            );
        });
    });

    describe('getBattleDetails', () => {
        it('should return battle with participants and problem', async () => {
            const battleDetails = {
                ...mockBattle,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        user: mockUser1,
                        testsPassed: 0,
                        totalTests: 2,
                    },
                ],
                problem: {
                    id: mockProblem.id,
                    title: mockProblem.title,
                    difficulty: mockProblem.difficulty,
                    description: mockProblem.description,
                    starterCode: mockProblem.starterCode,
                },
            };

            prisma.battle.findUnique.mockResolvedValue(battleDetails);

            const result = await service.getBattleDetails(mockBattle.id);

            expect(result.id).toBe(mockBattle.id);
            expect(result.problem).toBeDefined();
            expect(result.participants).toHaveLength(1);
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(
                service.getBattleDetails('nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('getBattleHistory', () => {
        it('should return paginated battle history for a user', async () => {
            const battles = [
                {
                    ...mockBattle,
                    participants: [{ userId: mockUser1.id, user: mockUser1 }],
                    problem: {
                        id: mockProblem.id,
                        title: mockProblem.title,
                        difficulty: mockProblem.difficulty,
                    },
                },
            ];

            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.battle.findMany.mockResolvedValue(battles);
            prisma.battle.count.mockResolvedValue(1);

            const result = await service.getBattleHistory(mockUser1.id);

            expect(result.data).toHaveLength(1);
            expect(result.meta).toEqual({
                total: 1,
                page: 1,
                limit: 20,
                totalPages: 1,
            });
        });

        it('should throw NotFoundException if user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.getBattleHistory('nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should handle pagination correctly', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.battle.findMany.mockResolvedValue([]);
            prisma.battle.count.mockResolvedValue(50);

            const result = await service.getBattleHistory(mockUser1.id, 2, 10);

            expect(prisma.battle.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 10,
                    take: 10,
                }),
            );
            expect(result.meta.page).toBe(2);
            expect(result.meta.limit).toBe(10);
            expect(result.meta.totalPages).toBe(5);
        });
    });

    describe('getAvailableBattles', () => {
        it('should return waiting battles that user is not in', async () => {
            const availableBattles = [
                {
                    ...mockBattle,
                    participants: [{ userId: mockUser2.id, user: mockUser2 }],
                    problem: {
                        id: mockProblem.id,
                        title: mockProblem.title,
                        difficulty: mockProblem.difficulty,
                    },
                },
            ];

            prisma.battle.findMany.mockResolvedValue(availableBattles);

            const result = await service.getAvailableBattles(mockUser1.id);

            expect(prisma.battle.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        status: BattleStatus.WAITING,
                        participants: {
                            none: { userId: mockUser1.id },
                        },
                    },
                }),
            );
            expect(result).toHaveLength(1);
        });
    });

    describe('MMR calculations', () => {
        it('should calculate correct MMR change for winner', async () => {
            // Test with equal MMR - winner should gain +16, loser should lose -16
            const battleWithEqualMmr = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        user: { ...mockUser1, mmr: 1000 },
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        user: { ...mockUser2, mmr: 1000 },
                        testsPassed: 1,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithEqualMmr)
                .mockResolvedValueOnce({
                    ...battleWithEqualMmr,
                    status: BattleStatus.COMPLETED,
                    winnerId: mockUser1.id,
                });

            let capturedMmrChanges: number[] = [];
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTx = {
                    ...prisma,
                    battleParticipant: {
                        update: jest.fn().mockImplementation((args) => {
                            capturedMmrChanges.push(args.data.mmrChange);
                            return Promise.resolve({});
                        }),
                    },
                    user: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    battle: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(mockTx);
            });

            await service.completeBattle(mockBattle.id);

            // With equal MMR (1000 vs 1000), expected score is 0.5
            // Winner gets: 32 * (1 - 0.5) = +16
            // Loser gets: 32 * (0 - 0.5) = -16
            expect(capturedMmrChanges).toContain(16);
            expect(capturedMmrChanges).toContain(-16);
        });

        it('should give more MMR when beating higher rated opponent', async () => {
            const battleWithMmrDiff = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        user: { ...mockUser1, mmr: 1000 }, // Lower rated
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        user: { ...mockUser2, mmr: 1200 }, // Higher rated
                        testsPassed: 1,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithMmrDiff)
                .mockResolvedValueOnce({
                    ...battleWithMmrDiff,
                    status: BattleStatus.COMPLETED,
                    winnerId: mockUser1.id,
                });

            let winnerMmrChange = 0;
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTx = {
                    ...prisma,
                    battleParticipant: {
                        update: jest.fn().mockImplementation((args) => {
                            // Track the first update (winner)
                            if (winnerMmrChange === 0) {
                                winnerMmrChange = args.data.mmrChange;
                            }
                            return Promise.resolve({});
                        }),
                    },
                    user: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                    battle: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(mockTx);
            });

            await service.completeBattle(mockBattle.id);

            // Underdog winning should get more than 16 points
            expect(winnerMmrChange).toBeGreaterThan(16);
        });
    });
});
