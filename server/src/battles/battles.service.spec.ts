import { Test, TestingModule } from '@nestjs/testing';
import { BattlesService } from './battles.service';
import { BattleRoyaleService } from './battle-royale.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { ProblemsService } from '../problems/problems.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { BattleMode, BattleStatus, Difficulty, SkillType } from '@prisma/client';
import { CreateBattleDto } from './dto/create-battle.dto';

describe('BattlesService', () => {
    let service: BattlesService;
    let prisma: MockPrismaService;
    let codeExecutionService: jest.Mocked<CodeExecutionService>;
    let subscriptionsService: jest.Mocked<SubscriptionsService>;
    let battleRoyaleService: {
        createRoyaleBattle: jest.Mock;
        enforceRoyaleJoinCap: jest.Mock;
        startRoyale: jest.Mock;
        submitRoyaleRound: jest.Mock;
    };

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
        clan: null,
        subscriptionTier: 'PRO',
        stripeCustomerId: null,
        gamesPlayedToday: 0,
        lastGameResetAt: new Date(),
        trialEndsAt: null,
        hasUsedTrial: false,
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
        clan: null,
        subscriptionTier: 'PRO',
        stripeCustomerId: null,
        gamesPlayedToday: 0,
        lastGameResetAt: new Date(),
        trialEndsAt: null,
        hasUsedTrial: false,
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
        winningTeam: null,
        teamSize: null,
        timeLimitMinutes: 5,
        autoBalance: true,
        enabledSkills: [] as SkillType[],
        inviteCode: null as string | null,
        inviteExpiresAt: null as Date | null,
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

        const mockSubscriptionsService = {
            canPlay: jest.fn().mockResolvedValue(true),
            incrementGamesPlayed: jest.fn().mockResolvedValue(undefined),
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
                {
                    provide: SubscriptionsService,
                    useValue: mockSubscriptionsService,
                },
                {
                    provide: SeasonsService,
                    useValue: {
                        getActiveSeason: jest.fn().mockResolvedValue({ id: 'season-1' }),
                        updatePeakMmr: jest.fn().mockResolvedValue(undefined),
                        incrementSeasonStats: jest.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: ProblemsService,
                    useValue: {
                        findRandom: jest.fn().mockResolvedValue({
                            id: 'problem-1',
                            title: 'Two Sum',
                            difficulty: Difficulty.EASY,
                            testCases: [],
                        }),
                    },
                },
                {
                    provide: BattleRoyaleService,
                    useValue: {
                        createRoyaleBattle: jest.fn(),
                        enforceRoyaleJoinCap: jest.fn(),
                        startRoyale: jest.fn(),
                        submitRoyaleRound: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<BattlesService>(BattlesService);
        prisma = module.get<MockPrismaService>(PrismaService);
        codeExecutionService = module.get(CodeExecutionService);
        subscriptionsService = module.get(SubscriptionsService);
        battleRoyaleService = module.get(BattleRoyaleService) as any;
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
                        teamId: null,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
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
                problemPool: null,
            };

            prisma.battle.create.mockResolvedValue(createdBattle);
            prisma.battle.findUnique.mockResolvedValue(createdBattle);

            const dto: CreateBattleDto = {
                problemId: mockProblem.id,
                mode: BattleMode.ONE_V_ONE,
            };

            const result = await service.createBattle(mockUser1.id, dto);

            expect(prisma.problem.findUnique).toHaveBeenCalledWith({
                where: { id: mockProblem.id },
                include: { testCases: true },
            });
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { id: mockUser1.id },
                include: { clan: true },
            });
            expect(prisma.battle.create).toHaveBeenCalled();
            expect(result.participants).toHaveLength(1);
            expect(result.status).toBe(BattleStatus.WAITING);
        });

        it('should throw NotFoundException if problem does not exist', async () => {
            prisma.problem.findUnique.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const dto: CreateBattleDto = {
                problemId: 'nonexistent',
                mode: BattleMode.ONE_V_ONE,
            };

            await expect(service.createBattle(mockUser1.id, dto)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException if user does not exist', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(null);

            const dto: CreateBattleDto = {
                problemId: mockProblem.id,
                mode: BattleMode.ONE_V_ONE,
            };

            await expect(service.createBattle('nonexistent', dto)).rejects.toThrow(
                NotFoundException,
            );
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
                        teamId: null,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: null,
                        mmrChange: null,
                        user: { mmr: mockUser1.mmr, clanId: null },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
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
                        teamId: null,
                        user: mockUser2,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
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
                problemPool: null,
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
                problemPool: null,
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
                        user: { mmr: mockUser1.mmr, clanId: null },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
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
                    { id: 'p1', userId: 'user-a', user: { mmr: 1000, clanId: null } },
                    { id: 'p2', userId: 'user-b', user: { mmr: 1000, clanId: null } },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            prisma.battle.findUnique.mockResolvedValue(fullBattle);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

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
            teamId: null,
            code: null,
            language: null,
            testsPassed: 0,
            totalTests: 2,
            pointsEarned: 0,
            submittedAt: null,
            mmrChange: null,
        };

        it('should submit and evaluate a solution', async () => {
            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant],
                problem: mockProblem,
                problemPool: null,
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
                problemPool: null,
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
                        stdout: null,
                        stderr: null,
                        error: null,
                        executionTime: '0.05s',
                    },
                    {
                        testCaseId: 'test-2',
                        passed: true,
                        input: '[Hidden]',
                        expectedOutput: '[Hidden]',
                        actualOutput: '[Hidden]',
                        stdout: null,
                        stderr: null,
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
                problemPool: null,
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
                problemPool: null,
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
                        teamId: null,
                        user: { ...mockUser1, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        user: { ...mockUser2, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
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
                        teamId: null,
                        user: { ...mockUser1, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:10'), // Submitted later
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        user: { ...mockUser2, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
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

        it('should result in draw when both have equal tests and same submission time', async () => {
            const submittedAt = new Date('2024-01-01T10:00:05');
            const battleWithDraw = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        teamId: null,
                        user: { ...mockUser1, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt,
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        user: { ...mockUser2, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt,
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithDraw)
                .mockResolvedValueOnce({
                    ...battleWithDraw,
                    status: BattleStatus.COMPLETED,
                    winnerId: null,
                });

            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(prisma);
            });

            const result = await service.completeBattle(mockBattle.id);

            expect(result.winnerId).toBeNull();
            expect(result.status).toBe(BattleStatus.COMPLETED);
        });

        it('should update user win/loss stats and MMR in transaction', async () => {
            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        teamId: null,
                        user: { ...mockUser1, mmr: 1000, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        user: { ...mockUser2, mmr: 1000, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
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

            const txCalls: { method: string; args: any }[] = [];
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTx = {
                    battle: {
                        update: jest.fn().mockImplementation((args) => {
                            txCalls.push({ method: 'battle.update', args });
                            return Promise.resolve({});
                        }),
                    },
                    battleParticipant: {
                        update: jest.fn().mockImplementation((args) => {
                            txCalls.push({ method: 'battleParticipant.update', args });
                            return Promise.resolve({});
                        }),
                    },
                    user: {
                        update: jest.fn().mockImplementation((args) => {
                            txCalls.push({ method: 'user.update', args });
                            return Promise.resolve({});
                        }),
                    },
                    clan: {
                        update: jest.fn().mockResolvedValue({}),
                    },
                };
                return callback(mockTx);
            });

            await service.completeBattle(mockBattle.id);

            // Verify battle was marked COMPLETED with winner
            const battleUpdate = txCalls.find(c => c.method === 'battle.update');
            expect(battleUpdate).toBeDefined();
            expect(battleUpdate!.args.data.status).toBe(BattleStatus.COMPLETED);
            expect(battleUpdate!.args.data.winnerId).toBe(mockUser1.id);

            // Verify winner gets wins incremented
            const userUpdates = txCalls.filter(c => c.method === 'user.update');
            expect(userUpdates).toHaveLength(2);

            const winnerUpdate = userUpdates.find(
                c => c.args.where.id === mockUser1.id,
            );
            expect(winnerUpdate).toBeDefined();
            expect(winnerUpdate!.args.data.wins).toEqual({ increment: 1 });

            // Verify loser gets losses incremented
            const loserUpdate = userUpdates.find(
                c => c.args.where.id === mockUser2.id,
            );
            expect(loserUpdate).toBeDefined();
            expect(loserUpdate!.args.data.losses).toEqual({ increment: 1 });
        });
    });

    describe('getBattleDetails', () => {
        it('should return battle with participants and problem', async () => {
            const battleDetails = {
                ...mockBattle,
                problemPool: null,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        teamId: null,
                        pointsEarned: 0,
                        user: { ...mockUser1, clan: null },
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
                    problemPool: null,
                    participants: [{ userId: mockUser1.id, teamId: null, pointsEarned: 0, user: { ...mockUser1, clan: null } }],
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
                        inviteCode: null,
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
            // Winner gets: 16 * (1 - 0.5) = +8
            // Loser gets: 16 * (0 - 0.5) = -8
            expect(capturedMmrChanges).toContain(8);
            expect(capturedMmrChanges).toContain(-8);
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

            // Underdog winning should get more than 8 points (K=16 base)
            expect(winnerMmrChange).toBeGreaterThan(8);
        });
    });

    describe('CLAN_VS_CLAN mode', () => {
        const mockClan1 = { id: 'clan-1', name: 'Team Alpha', mmr: 1500 };
        const mockClan2 = { id: 'clan-2', name: 'Team Beta', mmr: 1500 };

        const mockUserWithClan1 = {
            ...mockUser1,
            clanId: mockClan1.id,
            clan: mockClan1,
        };

        const mockUserWithClan2 = {
            ...mockUser2,
            clanId: mockClan2.id,
            clan: mockClan2,
        };

        it('should create a CLAN_VS_CLAN battle with team size', async () => {
            const clanBattle = {
                ...mockBattle,
                mode: BattleMode.CLAN_VS_CLAN,
                teamSize: 3,
                timeLimitMinutes: 30,
                participants: [
                    {
                        id: 'participant-1',
                        userId: mockUserWithClan1.id,
                        teamId: 'team-1',
                        pointsEarned: 0,
                        user: mockUserWithClan1,
                    },
                ],
                problem: null,
                problemPool: {
                    id: 'pool-1',
                    items: [{ problemId: mockProblem.id, problem: mockProblem }],
                },
            };

            prisma.user.findUnique.mockResolvedValue(mockUserWithClan1);
            prisma.problem.findMany.mockResolvedValue([mockProblem]);
            prisma.problemPool.create.mockResolvedValue({ id: 'pool-1' });
            prisma.battle.create.mockResolvedValue(clanBattle);
            prisma.battle.findUnique.mockResolvedValue(clanBattle);

            const dto: CreateBattleDto = {
                mode: BattleMode.CLAN_VS_CLAN,
                teamSize: 3,
                timeLimitMinutes: 30,
            };

            const result = await service.createBattle(mockUserWithClan1.id, dto);

            expect(result.mode).toBe(BattleMode.CLAN_VS_CLAN);
            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        mode: BattleMode.CLAN_VS_CLAN,
                        teamSize: 3,
                        timeLimitMinutes: 30,
                    }),
                }),
            );
        });

        it('should reject user without clan from joining CLAN_VS_CLAN battle', async () => {
            const clanBattle = {
                ...mockBattle,
                mode: BattleMode.CLAN_VS_CLAN,
                teamSize: 2,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUserWithClan1.id,
                        teamId: 'team-1',
                        user: { mmr: 1000, clanId: mockClan1.id },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            prisma.battle.findUnique.mockResolvedValue(clanBattle);
            prisma.user.findUnique.mockResolvedValue({ ...mockUser2, clanId: null });

            await expect(
                service.joinBattle(mockUser2.id, clanBattle.id),
            ).rejects.toThrow(BadRequestException);
        });

        it('should assign correct team based on clan membership', async () => {
            const clanBattle = {
                ...mockBattle,
                mode: BattleMode.CLAN_VS_CLAN,
                teamSize: 2,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUserWithClan1.id,
                        teamId: 'team-1',
                        user: { mmr: 1000, clanId: mockClan1.id },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            const updatedBattle = {
                ...clanBattle,
                participants: [
                    ...clanBattle.participants,
                    {
                        id: 'p2',
                        userId: mockUserWithClan2.id,
                        teamId: 'team-2',
                        user: { mmr: 1100, clanId: mockClan2.id },
                    },
                ],
            };

            prisma.battle.findUnique.mockResolvedValue(clanBattle);
            prisma.user.findUnique.mockResolvedValue(mockUserWithClan2);
            prisma.battle.update.mockResolvedValue(updatedBattle);

            const result = await service.joinBattle(mockUserWithClan2.id, clanBattle.id);

            // Second participant from different clan should be on team-2
            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        participants: {
                            create: expect.objectContaining({
                                teamId: 'team-2',
                            }),
                        },
                    }),
                }),
            );
        });

        it('should update clan wins/losses and MMR when completing a CLAN_VS_CLAN battle', async () => {
            const clanBattle = {
                ...mockBattle,
                mode: BattleMode.CLAN_VS_CLAN,
                status: BattleStatus.IN_PROGRESS,
                teamSize: 2,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUserWithClan1.id,
                        teamId: 'team-1',
                        pointsEarned: 10,
                        user: { ...mockUserWithClan1, clan: mockClan1 },
                        testsPassed: 2,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUserWithClan2.id,
                        teamId: 'team-2',
                        pointsEarned: 5,
                        user: { ...mockUserWithClan2, clan: mockClan2 },
                        testsPassed: 1,
                        totalTests: 2,
                        submittedAt: new Date(),
                        mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(clanBattle)
                .mockResolvedValueOnce({
                    ...clanBattle,
                    status: BattleStatus.COMPLETED,
                    winningTeam: 'team-1',
                });

            const txClanUpdates: Array<{ where: any; data: any }> = [];
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTx = {
                    ...prisma,
                    battle: { update: jest.fn().mockResolvedValue({}) },
                    battleParticipant: { update: jest.fn().mockResolvedValue({}) },
                    user: { update: jest.fn().mockResolvedValue({}) },
                    clan: {
                        update: jest.fn().mockImplementation((args) => {
                            txClanUpdates.push(args);
                            return Promise.resolve({});
                        }),
                    },
                };
                return callback(mockTx);
            });

            await service.completeBattle(mockBattle.id);

            // Winning clan gets +15 MMR and +1 win
            const winnerUpdate = txClanUpdates.find(
                (u) => u.where.id === mockClan1.id,
            );
            expect(winnerUpdate).toBeDefined();
            expect(winnerUpdate!.data.mmr).toEqual({ increment: 15 });
            expect(winnerUpdate!.data.wins).toEqual({ increment: 1 });

            // Losing clan gets -15 MMR and +1 loss
            const loserUpdate = txClanUpdates.find(
                (u) => u.where.id === mockClan2.id,
            );
            expect(loserUpdate).toBeDefined();
            expect(loserUpdate!.data.mmr).toEqual({ increment: -15 });
            expect(loserUpdate!.data.losses).toEqual({ increment: 1 });
        });
    });

    describe('GROUP mode', () => {
        it('should create a GROUP battle with problem pool', async () => {
            const mockProblems = [
                { ...mockProblem, id: 'problem-1' },
                { ...mockProblem, id: 'problem-2', difficulty: Difficulty.MEDIUM },
                { ...mockProblem, id: 'problem-3', difficulty: Difficulty.HARD },
            ];

            const groupBattle = {
                ...mockBattle,
                mode: BattleMode.GROUP,
                teamSize: 2,
                timeLimitMinutes: 60,
                autoBalance: true,
                participants: [
                    {
                        id: 'participant-1',
                        userId: mockUser1.id,
                        teamId: null,
                        pointsEarned: 0,
                        user: { ...mockUser1, clan: null },
                    },
                ],
                problem: null,
                problemPool: {
                    id: 'pool-1',
                    items: mockProblems.map((p) => ({
                        problemId: p.id,
                        problem: p,
                    })),
                },
            };

            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.problem.findMany.mockResolvedValue(mockProblems);
            prisma.battle.create.mockResolvedValue(groupBattle);
            prisma.battle.findUnique.mockResolvedValue(groupBattle);

            const dto: CreateBattleDto = {
                mode: BattleMode.GROUP,
                teamSize: 2,
                timeLimitMinutes: 60,
                autoBalance: true,
                problemIds: ['problem-1', 'problem-2', 'problem-3'],
            };

            const result = await service.createBattle(mockUser1.id, dto);

            expect(result.mode).toBe(BattleMode.GROUP);
            expect(prisma.problem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { in: dto.problemIds } },
                }),
            );
        });

        it('should use auto-balance for team assignment in GROUP mode', async () => {
            const groupBattle = {
                ...mockBattle,
                mode: BattleMode.GROUP,
                teamSize: 2,
                autoBalance: true,
                participants: [
                    {
                        id: 'p1',
                        userId: 'user-a',
                        teamId: 'team-1',
                        user: { mmr: 1200, clanId: null },
                    },
                    {
                        id: 'p2',
                        userId: 'user-b',
                        teamId: 'team-2',
                        user: { mmr: 1100, clanId: null },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            // New user - balance logic should assign to team with lower total MMR
            const newUser = { ...mockUser1, id: 'user-c', mmr: 1150, clanId: null };
            const updatedBattle = {
                ...groupBattle,
                participants: [
                    ...groupBattle.participants,
                    { id: 'p3', userId: newUser.id, teamId: 'team-2' },
                ],
            };

            prisma.battle.findUnique.mockResolvedValue(groupBattle);
            prisma.user.findUnique.mockResolvedValue(newUser);
            prisma.battle.update.mockResolvedValue(updatedBattle);

            await service.joinBattle(newUser.id, groupBattle.id);

            // Team 1 has 1200, team 2 has 1100.
            // Auto-balance assigns to team with lower MMR total (team-2)
            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        participants: {
                            create: expect.objectContaining({
                                teamId: 'team-2',
                            }),
                        },
                    }),
                }),
            );
        });
    });

    // =========================================
    // Subscription gating tests
    // =========================================

    describe('subscription gating', () => {
        it('should throw ForbiddenException when free user at daily limit tries to create battle', async () => {
            subscriptionsService.canPlay.mockResolvedValue(false);

            const dto: CreateBattleDto = {
                problemId: mockProblem.id,
                mode: BattleMode.ONE_V_ONE,
            };

            await expect(
                service.createBattle(mockUser1.id, dto),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException when free user at daily limit tries to join battle', async () => {
            subscriptionsService.canPlay.mockResolvedValue(false);

            await expect(
                service.joinBattle(mockUser2.id, mockBattle.id),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should allow pro user to create battle', async () => {
            subscriptionsService.canPlay.mockResolvedValue(true);
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            prisma.battle.create.mockResolvedValue({
                ...mockBattle,
                participants: [{
                    id: 'p1', battleId: mockBattle.id, userId: mockUser1.id,
                    teamId: null, code: null, language: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0, submittedAt: null,
                    mmrChange: null, user: mockUser1,
                }],
                problem: { id: mockProblem.id, title: mockProblem.title, difficulty: mockProblem.difficulty },
                problemPool: null,
            });
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattle,
                participants: [{
                    id: 'p1', battleId: mockBattle.id, userId: mockUser1.id,
                    teamId: null, code: null, language: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0, submittedAt: null,
                    mmrChange: null, user: mockUser1,
                }],
                problem: { id: mockProblem.id, title: mockProblem.title, difficulty: mockProblem.difficulty },
                problemPool: null,
            });

            const dto: CreateBattleDto = {
                problemId: mockProblem.id,
                mode: BattleMode.ONE_V_ONE,
            };

            const result = await service.createBattle(mockUser1.id, dto);
            expect(result).toBeDefined();
            expect(subscriptionsService.canPlay).toHaveBeenCalledWith(mockUser1.id);
        });

        it('should skip stats persistence for free users in completeBattle', async () => {
            const freeUser = { ...mockUser1, subscriptionTier: 'FREE' };
            const proUser = { ...mockUser2, subscriptionTier: 'PRO' };

            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: freeUser.id,
                        teamId: null,
                        user: { ...freeUser, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: proUser.id,
                        teamId: null,
                        user: { ...proUser, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
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
                    winnerId: freeUser.id,
                });

            const txMock = { ...prisma };
            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(txMock);
            });

            await service.completeBattle(mockBattle.id);

            // Free user (winner) should NOT get stats updated
            // Pro user (loser) should get stats updated
            const userUpdateCalls = txMock.user.update.mock.calls;
            const proUserUpdate = userUpdateCalls.find(
                (call) => call[0].where.id === proUser.id,
            );
            const freeUserUpdate = userUpdateCalls.find(
                (call) => call[0].where.id === freeUser.id,
            );

            expect(proUserUpdate).toBeDefined();
            expect(freeUserUpdate).toBeUndefined();
        });

        it('should persist stats for pro users in completeBattle', async () => {
            const proUser1 = { ...mockUser1, subscriptionTier: 'PRO' };
            const proUser2 = { ...mockUser2, subscriptionTier: 'PRO' };

            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: proUser1.id,
                        teamId: null,
                        user: { ...proUser1, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: proUser2.id,
                        teamId: null,
                        user: { ...proUser2, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
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
                    winnerId: proUser1.id,
                });

            const txMock = { ...prisma };
            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(txMock);
            });

            await service.completeBattle(mockBattle.id);

            // Both pro users should get stats updated
            const userUpdateCalls = txMock.user.update.mock.calls;
            expect(userUpdateCalls.length).toBeGreaterThanOrEqual(2);
        });

        it('should increment game count for all participants when battle starts', async () => {
            const battleWithOneParticipant = {
                ...mockBattle,
                participants: [
                    {
                        id: 'participant-1',
                        battleId: 'battle-1',
                        userId: mockUser1.id,
                        teamId: null,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: null,
                        mmrChange: null,
                        user: { mmr: mockUser1.mmr, clanId: null },
                    },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            prisma.battle.findUnique.mockResolvedValue(battleWithOneParticipant);
            prisma.user.findUnique.mockResolvedValue(mockUser2);

            const updatedBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date(),
                participants: [
                    { ...battleWithOneParticipant.participants[0], user: mockUser1 },
                    {
                        id: 'participant-2', battleId: 'battle-1', userId: mockUser2.id,
                        teamId: null, user: mockUser2, code: null, language: null,
                        testsPassed: 0, totalTests: 2, pointsEarned: 0,
                        submittedAt: null, mmrChange: null,
                    },
                ],
                problem: mockProblem,
                problemPool: null,
            };

            prisma.battle.update.mockResolvedValue(updatedBattle);

            await service.joinBattle(mockUser2.id, mockBattle.id);

            // Both participants should get game count incremented
            expect(subscriptionsService.incrementGamesPlayed).toHaveBeenCalledWith(mockUser1.id);
            expect(subscriptionsService.incrementGamesPlayed).toHaveBeenCalledWith(mockUser2.id);
        });

        it('should persist stats for trial users in completeBattle', async () => {
            const trialUser = {
                ...mockUser1,
                subscriptionTier: 'FREE',
                trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                hasUsedTrial: true,
            };
            const proUser = { ...mockUser2, subscriptionTier: 'PRO' };

            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: trialUser.id,
                        teamId: null,
                        user: { ...trialUser, clan: null },
                        testsPassed: 2,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: proUser.id,
                        teamId: null,
                        user: { ...proUser, clan: null },
                        testsPassed: 1,
                        totalTests: 2,
                        pointsEarned: 0,
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
                    winnerId: trialUser.id,
                });

            const txMock = { ...prisma };
            prisma.$transaction.mockImplementation(async (callback) => {
                return callback(txMock);
            });

            await service.completeBattle(mockBattle.id);

            // Trial user should get stats updated (Pro benefits)
            const userUpdateCalls = txMock.user.update.mock.calls;
            const trialUserUpdate = userUpdateCalls.find(
                (call) => call[0].where.id === trialUser.id,
            );
            expect(trialUserUpdate).toBeDefined();
        });
    });

    // =========================================
    // Skills System
    // =========================================

    describe('useSkill', () => {
        const mockBattleWithSkills = {
            ...mockBattle,
            status: BattleStatus.IN_PROGRESS,
            enabledSkills: [SkillType.FREEZE, SkillType.SCRAMBLE, SkillType.BLIND],
            participants: [
                {
                    id: 'p1',
                    battleId: 'battle-1',
                    userId: 'user-1',
                    teamId: null,
                    code: null,
                    language: null,
                    testsPassed: 1,
                    totalTests: 2,
                    pointsEarned: 0,
                    submittedAt: null,
                    mmrChange: null,
                },
                {
                    id: 'p2',
                    battleId: 'battle-1',
                    userId: 'user-2',
                    teamId: null,
                    code: null,
                    language: null,
                    testsPassed: 1,
                    totalTests: 2,
                    pointsEarned: 0,
                    submittedAt: null,
                    mmrChange: null,
                },
            ],
            skillUses: [],
        };

        it('should successfully use a skill on an opponent', async () => {
            prisma.battle.findUnique.mockResolvedValue(mockBattleWithSkills);

            const mockSkillUse = {
                id: 'su-1',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
                usedAt: new Date(),
            };
            prisma.battleSkillUse.create.mockResolvedValue(mockSkillUse);

            const result = await service.useSkill(
                'battle-1',
                'user-1',
                'user-2',
                SkillType.FREEZE,
            );

            expect(result).toEqual(mockSkillUse);
            expect(prisma.battleSkillUse.create).toHaveBeenCalledWith({
                data: {
                    battleId: 'battle-1',
                    userId: 'user-1',
                    targetUserId: 'user-2',
                    skillType: SkillType.FREEZE,
                },
            });
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(
                service.useSkill('nonexistent', 'user-1', 'user-2', SkillType.FREEZE),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if battle is not in progress', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                status: BattleStatus.WAITING,
            });

            await expect(
                service.useSkill('battle-1', 'user-1', 'user-2', SkillType.FREEZE),
            ).rejects.toThrow(/not in progress/);
        });

        it('should throw BadRequestException if skill is not enabled for the battle', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                enabledSkills: [SkillType.SCRAMBLE], // FREEZE not enabled
            });

            await expect(
                service.useSkill('battle-1', 'user-1', 'user-2', SkillType.FREEZE),
            ).rejects.toThrow(/FREEZE is not enabled/);
        });

        it('should throw ForbiddenException if user is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(mockBattleWithSkills);

            await expect(
                service.useSkill('battle-1', 'non-participant', 'user-2', SkillType.FREEZE),
            ).rejects.toThrow(/not a participant/);
        });

        it('should throw BadRequestException if target is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(mockBattleWithSkills);

            await expect(
                service.useSkill('battle-1', 'user-1', 'non-participant', SkillType.FREEZE),
            ).rejects.toThrow(/Target is not a participant/);
        });

        it('should throw BadRequestException if user targets themselves', async () => {
            prisma.battle.findUnique.mockResolvedValue(mockBattleWithSkills);

            await expect(
                service.useSkill('battle-1', 'user-1', 'user-1', SkillType.FREEZE),
            ).rejects.toThrow(/cannot use a skill on yourself/);
        });

        it('should throw BadRequestException if skill already used by this user', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                skillUses: [
                    {
                        id: 'su-1',
                        battleId: 'battle-1',
                        userId: 'user-1',
                        targetUserId: 'user-2',
                        skillType: SkillType.FREEZE,
                        usedAt: new Date(),
                    },
                ],
            });

            await expect(
                service.useSkill('battle-1', 'user-1', 'user-2', SkillType.FREEZE),
            ).rejects.toThrow(/already used FREEZE/);
        });

        it('should allow using a different skill after using one', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                skillUses: [
                    {
                        id: 'su-1',
                        battleId: 'battle-1',
                        userId: 'user-1',
                        targetUserId: 'user-2',
                        skillType: SkillType.FREEZE,
                        usedAt: new Date(),
                    },
                ],
            });

            const mockSkillUse = {
                id: 'su-2',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: SkillType.SCRAMBLE,
                usedAt: new Date(),
            };
            prisma.battleSkillUse.create.mockResolvedValue(mockSkillUse);

            const result = await service.useSkill(
                'battle-1',
                'user-1',
                'user-2',
                SkillType.SCRAMBLE,
            );

            expect(result).toEqual(mockSkillUse);
        });

        it('should allow a different user to use the same skill type', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                skillUses: [
                    {
                        id: 'su-1',
                        battleId: 'battle-1',
                        userId: 'user-1',
                        targetUserId: 'user-2',
                        skillType: SkillType.FREEZE,
                        usedAt: new Date(),
                    },
                ],
            });

            const mockSkillUse = {
                id: 'su-3',
                battleId: 'battle-1',
                userId: 'user-2',
                targetUserId: 'user-1',
                skillType: SkillType.FREEZE,
                usedAt: new Date(),
            };
            prisma.battleSkillUse.create.mockResolvedValue(mockSkillUse);

            const result = await service.useSkill(
                'battle-1',
                'user-2',
                'user-1',
                SkillType.FREEZE,
            );

            expect(result).toEqual(mockSkillUse);
        });
    });

    describe('createBattle with skills', () => {
        it('should create a battle with enabled skills', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const createdBattle = {
                ...mockBattle,
                enabledSkills: [SkillType.FREEZE, SkillType.SCRAMBLE],
                participants: [
                    {
                        id: 'p1',
                        battleId: 'battle-1',
                        userId: 'user-1',
                        user: mockUser1,
                        teamId: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: null,
                        mmrChange: null,
                    },
                ],
                problem: mockProblem,
                skillUses: [],
            };

            prisma.battle.create.mockResolvedValue(createdBattle);
            prisma.battle.findUnique.mockResolvedValue(createdBattle);

            const dto: CreateBattleDto = {
                problemId: 'problem-1',
                enabledSkills: [SkillType.FREEZE, SkillType.SCRAMBLE],
            };

            await service.createBattle('user-1', dto);

            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        enabledSkills: [SkillType.FREEZE, SkillType.SCRAMBLE],
                    }),
                }),
            );
        });

        it('should create a battle with empty skills by default', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const createdBattle = {
                ...mockBattle,
                participants: [
                    {
                        id: 'p1',
                        battleId: 'battle-1',
                        userId: 'user-1',
                        user: mockUser1,
                        teamId: null,
                        testsPassed: 0,
                        totalTests: 2,
                        pointsEarned: 0,
                        submittedAt: null,
                        mmrChange: null,
                    },
                ],
                problem: mockProblem,
                skillUses: [],
            };

            prisma.battle.create.mockResolvedValue(createdBattle);
            prisma.battle.findUnique.mockResolvedValue(createdBattle);

            const dto: CreateBattleDto = {
                problemId: 'problem-1',
            };

            await service.createBattle('user-1', dto);

            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        enabledSkills: [],
                    }),
                }),
            );
        });
    });

    describe('generateInviteCode', () => {
        it('should generate an 8-character uppercase alphanumeric code', async () => {
            prisma.battle.findFirst.mockResolvedValue(null); // no collision

            const code = await service.generateInviteCode();

            expect(code).toHaveLength(8);
            expect(code).toMatch(/^[A-Z2-9]+$/);
        });

        it('should retry if generated code already exists', async () => {
            // First call: collision, second call: no collision
            prisma.battle.findFirst
                .mockResolvedValueOnce({ id: 'existing-battle' }) // collision
                .mockResolvedValueOnce(null); // unique

            const code = await service.generateInviteCode();

            expect(code).toHaveLength(8);
            expect(prisma.battle.findFirst).toHaveBeenCalledTimes(2);
        });

        it('should throw after max attempts if all codes collide', async () => {
            // Always return a collision
            prisma.battle.findFirst.mockResolvedValue({ id: 'existing-battle' });

            await expect(service.generateInviteCode()).rejects.toThrow(
                /Failed to generate unique invite code/,
            );

            expect(prisma.battle.findFirst).toHaveBeenCalledTimes(10);
        });

        it('should not include ambiguous characters (I, O, 0, 1)', async () => {
            prisma.battle.findFirst.mockResolvedValue(null);

            // Generate many codes to statistically verify no ambiguous chars
            for (let i = 0; i < 20; i++) {
                const code = await service.generateInviteCode();
                expect(code).not.toMatch(/[IO01]/);
            }
        });

        it('should only check non-completed battles for uniqueness', async () => {
            prisma.battle.findFirst.mockResolvedValue(null);

            await service.generateInviteCode();

            expect(prisma.battle.findFirst).toHaveBeenCalledWith({
                where: {
                    inviteCode: expect.any(String),
                    status: { not: BattleStatus.COMPLETED },
                },
            });
        });
    });

    describe('createBattle with invite code', () => {
        it('should create a battle with invite code when withInviteCode is true', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);
            // No collision for invite code (now uses findFirst)
            prisma.battle.findFirst.mockResolvedValue(null);
            prisma.battle.findUnique.mockResolvedValue({         // getBattleDetails
                ...mockBattle,
                inviteCode: 'ABCD1234',
                inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    user: mockUser1, teamId: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0, isReady: false,
                    submittedAt: null, mmrChange: null,
                }],
                problem: mockProblem,
                skillUses: [],
            });

            prisma.battle.create.mockResolvedValue({
                ...mockBattle,
                inviteCode: 'ABCD1234',
                inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    user: mockUser1, teamId: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0, isReady: false,
                    submittedAt: null, mmrChange: null,
                }],
                problem: mockProblem,
            });

            const dto: CreateBattleDto = {
                problemId: 'problem-1',
                withInviteCode: true,
            };

            await service.createBattle('user-1', dto);

            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        inviteCode: expect.any(String),
                        inviteExpiresAt: expect.any(Date),
                    }),
                }),
            );
        });

        it('should create a battle without invite code when withInviteCode is false', async () => {
            prisma.problem.findUnique.mockResolvedValue(mockProblem);
            prisma.user.findUnique.mockResolvedValue(mockUser1);

            const createdBattle = {
                ...mockBattle,
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    user: mockUser1, teamId: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0, isReady: false,
                    submittedAt: null, mmrChange: null,
                }],
                problem: mockProblem,
                skillUses: [],
            };

            prisma.battle.create.mockResolvedValue(createdBattle);
            prisma.battle.findUnique.mockResolvedValue(createdBattle);

            await service.createBattle('user-1', { problemId: 'problem-1' });

            expect(prisma.battle.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        inviteCode: null,
                        inviteExpiresAt: null,
                    }),
                }),
            );
        });
    });

    describe('getByInviteCode', () => {
        const battleWithInvite = {
            ...mockBattle,
            inviteCode: 'ABCD1234',
            inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: BattleStatus.WAITING,
            participants: [{
                id: 'p1', battleId: 'battle-1', userId: 'user-1',
                user: { ...mockUser1, clan: null },
                teamId: null, testsPassed: 0, totalTests: 2,
                pointsEarned: 0, isReady: false, submittedAt: null, mmrChange: null,
            }],
            problem: { id: 'problem-1', title: 'Two Sum', difficulty: 'EASY' },
        };

        it('should return battle details for a valid invite code', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithInvite);

            const result = await service.getByInviteCode('ABCD1234');

            expect(result.id).toBe('battle-1');
            expect(result.inviteCode).toBe('ABCD1234');
            expect(prisma.battle.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { inviteCode: 'ABCD1234' },
                }),
            );
        });

        it('should be case-insensitive (normalizes to uppercase)', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithInvite);

            await service.getByInviteCode('abcd1234');

            expect(prisma.battle.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { inviteCode: 'ABCD1234' },
                }),
            );
        });

        it('should throw NotFoundException for invalid invite code', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(service.getByInviteCode('INVALID1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw BadRequestException for expired invite code', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...battleWithInvite,
                inviteExpiresAt: new Date(Date.now() - 1000), // expired
            });

            await expect(service.getByInviteCode('ABCD1234')).rejects.toThrow(
                /expired/,
            );
        });

        it('should throw BadRequestException if battle is no longer WAITING', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...battleWithInvite,
                status: BattleStatus.IN_PROGRESS,
            });

            await expect(service.getByInviteCode('ABCD1234')).rejects.toThrow(
                /no longer accepting/,
            );
        });

        it('should include rank tier in participant user data', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithInvite);

            const result = await service.getByInviteCode('ABCD1234');

            expect(result.participants[0].user).toHaveProperty('tier');
            expect(result.participants[0].user.tier).toHaveProperty('name');
        });
    });

    describe('joinByInviteCode', () => {
        it('should find battle by code and delegate to joinBattle', async () => {
            const battleWithInvite = {
                ...mockBattle,
                inviteCode: 'ABCD1234',
                inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: BattleStatus.WAITING,
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    user: { ...mockUser1, clan: null, mmr: 1000 },
                    teamId: null, testsPassed: 0, totalTests: 2,
                    pointsEarned: 0, isReady: false, submittedAt: null, mmrChange: null,
                }],
                problem: { id: 'problem-1', title: 'Two Sum', difficulty: 'EASY' },
            };

            // getByInviteCode lookup
            prisma.battle.findUnique
                .mockResolvedValueOnce(battleWithInvite) // getByInviteCode
                .mockResolvedValueOnce({                  // joinBattle: findUnique
                    ...battleWithInvite,
                    problem: { ...mockProblem },
                    problemPool: null,
                })
                .mockResolvedValueOnce(battleWithInvite); // getBattleDetails after join

            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.battle.update.mockResolvedValue(battleWithInvite);

            await service.joinByInviteCode('user-2', 'abcd1234');

            // Verify the code was normalized to uppercase for lookup
            expect(prisma.battle.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { inviteCode: 'ABCD1234' },
                }),
            );
        });
    });

    describe('readyUp', () => {
        const twoPlayerBattle = {
            ...mockBattle,
            inviteCode: 'ABCD1234',
            participants: [
                {
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, code: null, language: null,
                    testsPassed: 0, totalTests: 2, pointsEarned: 0,
                    isReady: false, submittedAt: null, mmrChange: null,
                },
                {
                    id: 'p2', battleId: 'battle-1', userId: 'user-2',
                    teamId: null, code: null, language: null,
                    testsPassed: 0, totalTests: 2, pointsEarned: 0,
                    isReady: false, submittedAt: null, mmrChange: null,
                },
            ],
        };

        beforeEach(() => {
            prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        });

        it('should mark a participant as ready', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(twoPlayerBattle) // readyUp tx lookup
                .mockResolvedValueOnce({                 // getBattleDetails
                    ...twoPlayerBattle,
                    participants: [{
                        ...twoPlayerBattle.participants[0], isReady: true,
                        user: { ...mockUser1, clan: null },
                    }, {
                        ...twoPlayerBattle.participants[1], isReady: false,
                        user: { ...mockUser2, clan: null },
                    }],
                    problem: mockProblem,
                    skillUses: [],
                });
            prisma.battleParticipant.update.mockResolvedValue({
                ...twoPlayerBattle.participants[0], isReady: true,
            });

            const result = await service.readyUp('battle-1', 'user-1');

            expect(result.started).toBe(false);
            expect(prisma.battleParticipant.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { isReady: true },
            });
        });

        it('should start battle when all participants are ready', async () => {
            const battleOneReady = {
                ...twoPlayerBattle,
                participants: [
                    { ...twoPlayerBattle.participants[0], isReady: true },  // user-1 already ready
                    { ...twoPlayerBattle.participants[1], isReady: false }, // user-2 about to ready
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(battleOneReady) // readyUp tx lookup
                .mockResolvedValueOnce({               // getBattleDetails after start
                    ...battleOneReady,
                    status: BattleStatus.IN_PROGRESS,
                    startedAt: new Date(),
                    participants: battleOneReady.participants.map((p) => ({
                        ...p, isReady: true,
                        user: p.userId === 'user-1'
                            ? { ...mockUser1, clan: null }
                            : { ...mockUser2, clan: null },
                    })),
                    problem: mockProblem,
                    skillUses: [],
                });

            prisma.battleParticipant.update.mockResolvedValue({
                ...battleOneReady.participants[1], isReady: true,
            });
            prisma.battle.update.mockResolvedValue({
                ...battleOneReady,
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date(),
            });

            const result = await service.readyUp('battle-1', 'user-2');

            expect(result.started).toBe(true);
            // Should have started the battle
            expect(prisma.battle.update).toHaveBeenCalledWith({
                where: { id: 'battle-1' },
                data: {
                    status: BattleStatus.IN_PROGRESS,
                    startedAt: expect.any(Date),
                },
            });
            // Should have incremented game counts for both players
            expect(subscriptionsService.incrementGamesPlayed).toHaveBeenCalledWith('user-1');
            expect(subscriptionsService.incrementGamesPlayed).toHaveBeenCalledWith('user-2');
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(service.readyUp('nonexistent', 'user-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw BadRequestException if battle is not WAITING', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...twoPlayerBattle,
                status: BattleStatus.IN_PROGRESS,
            });

            await expect(service.readyUp('battle-1', 'user-1')).rejects.toThrow(
                /not in waiting state/,
            );
        });

        it('should throw ForbiddenException if user is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(twoPlayerBattle);

            await expect(service.readyUp('battle-1', 'non-participant')).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw BadRequestException if user is already ready', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...twoPlayerBattle,
                participants: [
                    { ...twoPlayerBattle.participants[0], isReady: true },
                    twoPlayerBattle.participants[1],
                ],
            });

            await expect(service.readyUp('battle-1', 'user-1')).rejects.toThrow(
                /already ready/,
            );
        });

        it('should throw BadRequestException if only one participant', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...twoPlayerBattle,
                participants: [twoPlayerBattle.participants[0]],
            });

            await expect(service.readyUp('battle-1', 'user-1')).rejects.toThrow(
                /Not enough players/,
            );
        });

        it('should not start if only some participants are ready', async () => {
            const threePlayerBattle = {
                ...twoPlayerBattle,
                participants: [
                    { ...twoPlayerBattle.participants[0], isReady: false },
                    { ...twoPlayerBattle.participants[1], isReady: false },
                    {
                        id: 'p3', battleId: 'battle-1', userId: 'user-3',
                        teamId: null, code: null, language: null,
                        testsPassed: 0, totalTests: 2, pointsEarned: 0,
                        isReady: false, submittedAt: null, mmrChange: null,
                    },
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(threePlayerBattle) // tx lookup
                .mockResolvedValueOnce({                   // getBattleDetails
                    ...threePlayerBattle,
                    participants: threePlayerBattle.participants.map((p) => ({
                        ...p,
                        user: { ...mockUser1, id: p.userId, clan: null },
                    })),
                    problem: mockProblem,
                    skillUses: [],
                });
            prisma.battleParticipant.update.mockResolvedValue({
                ...threePlayerBattle.participants[0], isReady: true,
            });

            const result = await service.readyUp('battle-1', 'user-1');

            expect(result.started).toBe(false);
            // Should NOT have updated battle status
            expect(prisma.battle.update).not.toHaveBeenCalled();
        });

        it('should execute readyUp within a transaction', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(twoPlayerBattle)
                .mockResolvedValueOnce({
                    ...twoPlayerBattle,
                    participants: twoPlayerBattle.participants.map((p) => ({
                        ...p,
                        user: { ...mockUser1, id: p.userId, clan: null },
                    })),
                    problem: mockProblem,
                    skillUses: [],
                });
            prisma.battleParticipant.update.mockResolvedValue({
                ...twoPlayerBattle.participants[0], isReady: true,
            });

            await service.readyUp('battle-1', 'user-1');

            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
            expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('unready', () => {
        const twoPlayerBattle = {
            ...mockBattle,
            participants: [
                {
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, isReady: true,
                    code: null, language: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0,
                    submittedAt: null, mmrChange: null,
                },
                {
                    id: 'p2', battleId: 'battle-1', userId: 'user-2',
                    teamId: null, isReady: false,
                    code: null, language: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0,
                    submittedAt: null, mmrChange: null,
                },
            ],
        };

        it('should set a ready participant back to not ready', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(twoPlayerBattle)
                .mockResolvedValueOnce({
                    ...twoPlayerBattle,
                    participants: twoPlayerBattle.participants.map((p) => ({
                        ...p, isReady: false,
                        user: { ...mockUser1, id: p.userId, clan: null },
                    })),
                    problem: mockProblem,
                    skillUses: [],
                });
            prisma.battleParticipant.update.mockResolvedValue({
                ...twoPlayerBattle.participants[0], isReady: false,
            });

            await service.unready('battle-1', 'user-1');

            expect(prisma.battleParticipant.update).toHaveBeenCalledWith({
                where: { id: 'p1' },
                data: { isReady: false },
            });
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(service.unready('nonexistent', 'user-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw BadRequestException if battle is not WAITING', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...twoPlayerBattle,
                status: BattleStatus.IN_PROGRESS,
            });

            await expect(service.unready('battle-1', 'user-1')).rejects.toThrow(
                /not in waiting state/,
            );
        });

        it('should throw ForbiddenException if user is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(twoPlayerBattle);

            await expect(service.unready('battle-1', 'non-participant')).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw BadRequestException if user is not currently ready', async () => {
            prisma.battle.findUnique.mockResolvedValue(twoPlayerBattle);

            await expect(service.unready('battle-1', 'user-2')).rejects.toThrow(
                /not currently ready/,
            );
        });
    });

    describe('inviteUserToBattle', () => {
        const battleWithParticipant = {
            ...mockBattle,
            inviteCode: 'ABCD1234',
            participants: [
                {
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, isReady: false,
                    code: null, language: null, testsPassed: 0,
                    totalTests: 2, pointsEarned: 0,
                    submittedAt: null, mmrChange: null,
                },
            ],
        };

        it('should return invite data for a valid invite', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithParticipant);
            prisma.user.findUnique
                .mockResolvedValueOnce(mockUser2)                          // target user lookup
                .mockResolvedValueOnce({ username: 'alice', avatarUrl: null }); // inviter info

            const result = await service.inviteUserToBattle('battle-1', 'user-1', 'bob');

            expect(result.targetUserId).toBe('user-2');
            expect(result.battleId).toBe('battle-1');
            expect(result.inviterUsername).toBe('alice');
            expect(result.battleMode).toBe(BattleMode.ONE_V_ONE);
            expect(result.inviteCode).toBe('ABCD1234');
        });

        it('should throw NotFoundException if battle does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(null);

            await expect(
                service.inviteUserToBattle('nonexistent', 'user-1', 'bob'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if battle is not WAITING', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...battleWithParticipant,
                status: BattleStatus.IN_PROGRESS,
            });

            await expect(
                service.inviteUserToBattle('battle-1', 'user-1', 'bob'),
            ).rejects.toThrow(/not accepting players/);
        });

        it('should throw ForbiddenException if inviter is not a participant', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithParticipant);

            await expect(
                service.inviteUserToBattle('battle-1', 'non-participant', 'bob'),
            ).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if target user does not exist', async () => {
            prisma.battle.findUnique.mockResolvedValue(battleWithParticipant);
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.inviteUserToBattle('battle-1', 'user-1', 'nonexistent'),
            ).rejects.toThrow(/not found/);
        });

        it('should throw BadRequestException if target user is already in battle', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...battleWithParticipant,
                participants: [
                    ...battleWithParticipant.participants,
                    {
                        id: 'p2', battleId: 'battle-1', userId: 'user-2',
                        teamId: null, isReady: false,
                        code: null, language: null, testsPassed: 0,
                        totalTests: 2, pointsEarned: 0,
                        submittedAt: null, mmrChange: null,
                    },
                ],
            });
            prisma.user.findUnique.mockResolvedValue(mockUser2);

            await expect(
                service.inviteUserToBattle('battle-1', 'user-1', 'bob'),
            ).rejects.toThrow(/already in this battle/);
        });
    });

    describe('joinBattle with invite code (no auto-start)', () => {
        it('should throw BadRequestException when directly joining an invite-code battle', async () => {
            const inviteBattle = {
                ...mockBattle,
                inviteCode: 'ABCD1234',
                inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, code: null, language: null,
                    testsPassed: 0, totalTests: 2, pointsEarned: 0,
                    isReady: false, submittedAt: null, mmrChange: null,
                    user: { mmr: 1000, clanId: null },
                }],
                problem: { ...mockProblem },
                problemPool: null,
            };

            prisma.battle.findUnique.mockResolvedValue(inviteBattle);
            prisma.user.findUnique.mockResolvedValue(mockUser2);

            await expect(
                service.joinBattle('user-2', 'battle-1'),
            ).rejects.toThrow(/invite code to join/);
        });

        it('should not auto-start a 1v1 invite battle when joined via invite code', async () => {
            const inviteBattle = {
                ...mockBattle,
                inviteCode: 'ABCD1234',
                inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, code: null, language: null,
                    testsPassed: 0, totalTests: 2, pointsEarned: 0,
                    isReady: false, submittedAt: null, mmrChange: null,
                    user: { mmr: 1000, clanId: null },
                }],
                problem: { ...mockProblem },
                problemPool: null,
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(inviteBattle)  // joinBattle lookup
                .mockResolvedValueOnce(inviteBattle); // not used for this test path
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.battle.update.mockResolvedValue(inviteBattle);

            await service.joinBattle('user-2', 'battle-1', undefined, true);

            // Should NOT start the battle - status stays WAITING
            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: BattleStatus.WAITING,
                    }),
                }),
            );
            // Should NOT have incremented game counts
            expect(subscriptionsService.incrementGamesPlayed).not.toHaveBeenCalled();
        });

        it('should auto-start a non-invite 1v1 battle when second player joins', async () => {
            const normalBattle = {
                ...mockBattle,
                inviteCode: null,
                participants: [{
                    id: 'p1', battleId: 'battle-1', userId: 'user-1',
                    teamId: null, code: null, language: null,
                    testsPassed: 0, totalTests: 2, pointsEarned: 0,
                    isReady: false, submittedAt: null, mmrChange: null,
                    user: { mmr: 1000, clanId: null },
                }],
                problem: { ...mockProblem },
                problemPool: null,
            };

            prisma.battle.findUnique.mockResolvedValue(normalBattle);
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.battle.update.mockResolvedValue({
                ...normalBattle,
                status: BattleStatus.IN_PROGRESS,
            });

            await service.joinBattle('user-2', 'battle-1');

            // SHOULD start the battle
            expect(prisma.battle.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: BattleStatus.IN_PROGRESS,
                    }),
                }),
            );
            // Should have incremented game counts
            expect(subscriptionsService.incrementGamesPlayed).toHaveBeenCalledTimes(2);
        });
    });

    describe('BATTLE_ROYALE delegation', () => {
        it('createBattle delegates to BattleRoyaleService.createRoyaleBattle when mode is BATTLE_ROYALE', async () => {
            battleRoyaleService.createRoyaleBattle.mockResolvedValue({
                id: 'battle-br',
            } as any);

            const dto: CreateBattleDto = {
                mode: BattleMode.BATTLE_ROYALE,
                battleRoyaleFormat: 'SAME_PROBLEM' as any,
                maxPlayers: 4,
                rounds: [
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ],
            } as any;

            const result = await service.createBattle('user-1', dto);

            expect(battleRoyaleService.createRoyaleBattle).toHaveBeenCalledWith(
                'user-1',
                expect.objectContaining({
                    mode: BattleMode.BATTLE_ROYALE,
                    battleRoyaleFormat: 'SAME_PROBLEM',
                    maxPlayers: 4,
                }),
            );
            expect(result).toEqual({ id: 'battle-br' });
            // The non-BR create path should NOT be taken
            expect(prisma.battle.create).not.toHaveBeenCalled();
        });

        it('joinBattle calls enforceRoyaleJoinCap for BR battles', async () => {
            const royaleBattle = {
                ...mockBattle,
                mode: BattleMode.BATTLE_ROYALE,
                maxPlayers: 4,
                participants: [
                    {
                        id: 'p1',
                        battleId: 'battle-br',
                        userId: 'user-1',
                        teamId: null,
                        code: null,
                        language: null,
                        testsPassed: 0,
                        totalTests: 0,
                        pointsEarned: 0,
                        submittedAt: null,
                        mmrChange: null,
                        user: { mmr: 1000, clanId: null },
                    },
                ],
                problem: null,
                problemPool: null,
            } as any;

            prisma.battle.findUnique.mockResolvedValue(royaleBattle);
            prisma.user.findUnique.mockResolvedValue(mockUser2);
            prisma.battleParticipant.create.mockResolvedValue({
                id: 'p2',
                battleId: 'battle-br',
                userId: 'user-2',
            } as any);

            await service.joinBattle('user-2', 'battle-br');

            expect(battleRoyaleService.enforceRoyaleJoinCap).toHaveBeenCalledWith(
                royaleBattle,
            );
        });

        it('submitSolution for BR delegates to submitRoyaleRound and skips normal path', async () => {
            const royaleBattle = {
                id: 'battle-br',
                mode: BattleMode.BATTLE_ROYALE,
                status: BattleStatus.IN_PROGRESS,
                problemId: null,
                participants: [
                    {
                        id: 'p1',
                        userId: 'user-1',
                        battleId: 'battle-br',
                        submittedAt: null,
                        isEliminated: false,
                    },
                ],
                problem: null,
                problemPool: null,
                rounds: [],
            } as any;

            prisma.battle.findUnique.mockResolvedValue(royaleBattle);
            battleRoyaleService.submitRoyaleRound.mockResolvedValue({
                testsPassed: 2,
                totalTests: 2,
                allPassed: true,
                results: [],
            });

            const result = await service.submitSolution(
                'battle-br',
                'user-1',
                'code',
                'js',
                'problem-1',
            );

            expect(battleRoyaleService.submitRoyaleRound).toHaveBeenCalledWith(
                'battle-br',
                'user-1',
                'code',
                'js',
                'problem-1',
            );
            // Normal submitSolution should not have executed code directly
            expect(codeExecutionService.executeCode).not.toHaveBeenCalled();
            expect(result).toEqual(
                expect.objectContaining({ testsPassed: 2, allPassed: true }),
            );
        });

        it('readyUp for BR calls startRoyale when lobby full and all ready', async () => {
            const battle = {
                id: 'battle-br',
                mode: BattleMode.BATTLE_ROYALE,
                status: BattleStatus.WAITING,
                maxPlayers: 2,
                participants: [
                    {
                        id: 'p1',
                        battleId: 'battle-br',
                        userId: 'user-1',
                        isReady: true,
                        user: mockUser1,
                    },
                    {
                        id: 'p2',
                        battleId: 'battle-br',
                        userId: 'user-2',
                        isReady: false,
                        user: mockUser2,
                    },
                ],
            } as any;

            prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
            prisma.battle.findUnique
                .mockResolvedValueOnce(battle) // tx lookup
                .mockResolvedValueOnce({
                    ...battle,
                    status: BattleStatus.IN_PROGRESS,
                    participants: battle.participants.map((p: any) => ({
                        ...p,
                        isReady: true,
                        user: { ...p.user, clan: null },
                    })),
                    problem: null,
                    skillUses: [],
                });
            prisma.battleParticipant.update.mockResolvedValue({
                ...battle.participants[1],
                isReady: true,
            });

            const result = await service.readyUp('battle-br', 'user-2');

            expect(battleRoyaleService.startRoyale).toHaveBeenCalledWith(
                'battle-br',
            );
            expect(result.started).toBe(true);
            // BR must NOT increment games via BattlesService (BR does it inside
            // startRoyale to keep the self-contained flow).
            expect(
                subscriptionsService.incrementGamesPlayed,
            ).not.toHaveBeenCalled();
            // Non-BR "start battle" tx update should NOT be taken.
            expect(prisma.battle.update).not.toHaveBeenCalled();
        });

        it('createBattle propagates validation errors from BattleRoyaleService (does not silently fall through to the 1v1 path)', async () => {
            const boom = new Error('Sum of eliminateCount mismatch');
            battleRoyaleService.createRoyaleBattle.mockRejectedValue(boom);

            const dto: CreateBattleDto = {
                mode: BattleMode.BATTLE_ROYALE,
                battleRoyaleFormat: 'SAME_PROBLEM' as any,
                maxPlayers: 4,
                rounds: [{ timeLimitSeconds: 300, eliminateCount: 1 }],
            } as any;

            await expect(service.createBattle('user-1', dto)).rejects.toBe(boom);
            // Must NOT fall through to the non-BR 1v1 path.
            expect(prisma.battle.create).not.toHaveBeenCalled();
        });

        it('readyUp for BR rejects when lobby is not full', async () => {
            const battle = {
                id: 'battle-br',
                mode: BattleMode.BATTLE_ROYALE,
                status: BattleStatus.WAITING,
                maxPlayers: 4,
                participants: [
                    {
                        id: 'p1',
                        userId: 'user-1',
                        isReady: false,
                        user: mockUser1,
                    },
                    {
                        id: 'p2',
                        userId: 'user-2',
                        isReady: false,
                        user: mockUser2,
                    },
                ],
            } as any;

            prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
            prisma.battle.findUnique.mockResolvedValue(battle);

            await expect(service.readyUp('battle-br', 'user-1')).rejects.toThrow(
                /lobby is not full/,
            );
            expect(battleRoyaleService.startRoyale).not.toHaveBeenCalled();
        });
    });
});
