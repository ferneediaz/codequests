import { Test, TestingModule } from '@nestjs/testing';
import { BattlesService } from './battles.service';
import { BattleRoyaleService } from './battle-royale.service';
import { ClanWarsService } from './clan-wars.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SeasonsService } from '../seasons/seasons.service';
import { AchievementsService } from '../achievements/achievements.service';
import { ProblemsService } from '../problems/problems.service';
import { BATTLE_EVENTS_PORT } from '../realtime/ports/battle-events.port';
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
    let battlesGateway: {
        emitBattleSubmission: jest.Mock;
        emitBattleCompleted: jest.Mock;
        emitBattleStatusUpdate: jest.Mock;
        emitBattleRematchCreated: jest.Mock;
    };
    let achievementsService: { runChecks: jest.Mock };

    // Mock data
    const mockUser1 = {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        avatarUrl: null,
        mmr: 1000,
        wins: 5,
        losses: 3,
        currentWinStreak: 0,
        bestWinStreak: 2,
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
        currentWinStreak: 0,
        bestWinStreak: 4,
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
                {
                    provide: ClanWarsService,
                    useValue: {
                        createClanWarsBattle: jest.fn(),
                        joinClanWarsBattle: jest.fn(),
                        startClanWars: jest.fn(),
                        submitClanWarsRound: jest.fn(),
                        readyForNextRound: jest
                            .fn()
                            .mockResolvedValue({ allReady: false }),
                        unreadyForNextRound: jest
                            .fn()
                            .mockResolvedValue(undefined),
                    },
                },
                {
                    provide: BATTLE_EVENTS_PORT,
                    useValue: {
                        emitBattleSubmission: jest.fn(),
                        emitBattleCompleted: jest.fn(),
                        emitBattleStatusUpdate: jest.fn(),
                        emitBattleRematchCreated: jest.fn(),
                    },
                },
                {
                    provide: AchievementsService,
                    useValue: {
                        runChecks: jest.fn().mockResolvedValue([]),
                        runChecksForSeasonTop: jest.fn().mockResolvedValue([]),
                        listForUser: jest.fn().mockResolvedValue([]),
                        seedDefinitions: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        service = module.get<BattlesService>(BattlesService);
        prisma = module.get<MockPrismaService>(PrismaService);
        codeExecutionService = module.get(CodeExecutionService);
        subscriptionsService = module.get(SubscriptionsService);
        battleRoyaleService = module.get(BattleRoyaleService) as any;
        battlesGateway = module.get(BATTLE_EVENTS_PORT) as any;
        achievementsService = module.get(AchievementsService) as any;
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

        it('should submit and evaluate a partial solution without auto-completing', async () => {
            // Two-player 1v1 where the submitter passes 1/2 tests and the
            // opponent hasn't submitted yet. Neither the "first-to-fully-pass"
            // nor the "all submitted" end-conditions fire, so completeBattle
            // stays dormant and only the live progress event goes out.
            const opponentParticipant = {
                ...mockParticipant,
                id: 'p2',
                userId: mockUser2.id,
                submittedAt: null,
            };

            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant, opponentParticipant],
                problem: mockProblem,
                problemPool: null,
            };

            const afterSubmit = {
                ...inProgressBattle,
                participants: [
                    { ...mockParticipant, submittedAt: new Date(), testsPassed: 1 },
                    opponentParticipant,
                ],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(inProgressBattle)
                .mockResolvedValueOnce(afterSubmit);

            prisma.user.findUnique.mockResolvedValue({
                username: mockUser1.username,
            } as any);

            codeExecutionService.executeCode.mockResolvedValue({
                passed: 1,
                total: 2,
                allPassed: false,
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
                        passed: false,
                        input: '[Hidden]',
                        expectedOutput: '[Hidden]',
                        actualOutput: null,
                        stdout: null,
                        stderr: null,
                        error: 'failed',
                        executionTime: '0.04s',
                    },
                ],
            });

            prisma.battleParticipant.update.mockResolvedValue({
                ...mockParticipant,
                code: 'function twoSum() {}',
                language: 'javascript',
                testsPassed: 1,
                submittedAt: new Date(),
            });

            const result = await service.submitSolution(
                mockBattle.id,
                mockUser1.id,
                'function twoSum() {}',
                'javascript',
            );

            expect(result.testsPassed).toBe(1);
            expect(result.totalTests).toBe(2);
            expect(result.allPassed).toBe(false);
            expect(codeExecutionService.executeCode).toHaveBeenCalledWith(
                mockProblem.id,
                'function twoSum() {}',
                'javascript',
            );
            expect(battlesGateway.emitBattleSubmission).toHaveBeenCalledWith(
                mockBattle.id,
                expect.objectContaining({
                    userId: mockUser1.id,
                    username: mockUser1.username,
                    testsPassed: 1,
                    totalTests: 2,
                }),
            );
            // Battle stays live — no completion event yet.
            expect(battlesGateway.emitBattleCompleted).not.toHaveBeenCalled();
        });

        it('should auto-complete a 1v1 when a participant passes all tests (fastest-correct-wins)', async () => {
            // Regression test for the "opponent never learned about my win"
            // bug: the 1v1 path must finalize the battle the moment any
            // participant fully solves the problem, even if the opponent
            // hasn't submitted anything yet.
            const opponent = {
                ...mockParticipant,
                id: 'p2',
                userId: mockUser2.id,
                submittedAt: null,
                user: { ...mockUser2, clan: null },
            };
            const selfWithUser = {
                ...mockParticipant,
                user: { ...mockUser1, clan: null },
            };

            const inProgressBattle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [mockParticipant, opponent],
                problem: mockProblem,
                problemPool: null,
            };

            // After submitSolution writes the participant row, completeBattle
            // re-reads the battle (with user.clan include) to decide the winner
            // and MMR; then getBattleDetails re-reads it one final time for
            // the response payload and the websocket broadcast.
            const battleForComplete = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    { ...selfWithUser, testsPassed: 2, submittedAt: new Date() },
                    opponent,
                ],
            };
            const finalizedBattle = {
                ...mockBattle,
                status: BattleStatus.COMPLETED,
                winnerId: mockUser1.id,
                endedAt: new Date(),
                participants: [
                    { ...selfWithUser, testsPassed: 2, submittedAt: new Date() },
                    opponent,
                ],
                problem: mockProblem,
                problemPool: null,
                skillUses: [],
            };

            prisma.battle.findUnique
                .mockResolvedValueOnce(inProgressBattle)
                .mockResolvedValueOnce(battleForComplete)
                .mockResolvedValueOnce(finalizedBattle);

            prisma.user.findUnique.mockResolvedValue({
                username: mockUser1.username,
            } as any);

            codeExecutionService.executeCode.mockResolvedValue({
                passed: 2,
                total: 2,
                allPassed: true,
                results: [],
            });

            prisma.battleParticipant.update.mockResolvedValue({
                ...mockParticipant,
                testsPassed: 2,
                submittedAt: new Date(),
            });
            prisma.$transaction.mockImplementation(async (callback) =>
                callback(prisma),
            );

            const result = await service.submitSolution(
                mockBattle.id,
                mockUser1.id,
                'function twoSum() { /* solved */ }',
                'javascript',
            );

            expect(result.allPassed).toBe(true);
            // Progress event fires for every submission…
            expect(battlesGateway.emitBattleSubmission).toHaveBeenCalledWith(
                mockBattle.id,
                expect.objectContaining({
                    userId: mockUser1.id,
                    testsPassed: 2,
                    totalTests: 2,
                }),
            );
            // …and the battle.completed event fires immediately because the
            // submitter fully solved the problem (opponent never needs to
            // submit for the game to end).
            expect(battlesGateway.emitBattleCompleted).toHaveBeenCalledWith(
                mockBattle.id,
                expect.objectContaining({
                    status: BattleStatus.COMPLETED,
                    winnerId: mockUser1.id,
                }),
            );
        });

        it('should broadcast live submission progress in team battles without auto-completing', async () => {
            // Team modes resolve via the timer-triggered /complete endpoint,
            // so a submission in a GROUP battle should NEVER auto-complete
            // the match — but teammates/opponents still need to see live
            // progress.
            const teamBattle = {
                ...mockBattle,
                mode: BattleMode.GROUP,
                teamSize: 2,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    { ...mockParticipant, teamId: 'team-1' },
                    {
                        ...mockParticipant,
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: 'team-2',
                    },
                ],
                problem: null,
                problemPool: {
                    items: [
                        {
                            problemId: mockProblem.id,
                            pointValue: 2,
                        },
                    ],
                },
            };

            prisma.battle.findUnique.mockResolvedValue(teamBattle);
            prisma.user.findUnique.mockResolvedValue({
                username: mockUser1.username,
            } as any);

            codeExecutionService.executeCode.mockResolvedValue({
                passed: 2,
                total: 2,
                allPassed: true,
                results: [],
            });

            prisma.battleParticipant.update.mockResolvedValue({
                ...mockParticipant,
            });

            await service.submitSolution(
                mockBattle.id,
                mockUser1.id,
                'function solved() {}',
                'javascript',
                mockProblem.id,
            );

            expect(battlesGateway.emitBattleSubmission).toHaveBeenCalledWith(
                mockBattle.id,
                expect.objectContaining({
                    userId: mockUser1.id,
                    testsPassed: 2,
                    totalTests: 2,
                }),
            );
            expect(battlesGateway.emitBattleCompleted).not.toHaveBeenCalled();
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
            // mockUser1 starts with currentWinStreak: 0, bestWinStreak: 2 →
            // current goes 0→1 (no new best, since 1 < 2).
            expect(winnerUpdate!.args.data.currentWinStreak).toBe(1);
            expect(winnerUpdate!.args.data.bestWinStreak).toBeUndefined();

            // Verify loser gets losses incremented and streak reset
            const loserUpdate = userUpdates.find(
                c => c.args.where.id === mockUser2.id,
            );
            expect(loserUpdate).toBeDefined();
            expect(loserUpdate!.args.data.losses).toEqual({ increment: 1 });
            expect(loserUpdate!.args.data.currentWinStreak).toBe(0);
            expect(loserUpdate!.args.data.bestWinStreak).toBeUndefined();
        });

        it('should update bestWinStreak when current streak surpasses best', async () => {
            // Winner already on a hot streak — about to set a new personal best.
            const hotUser = { ...mockUser1, currentWinStreak: 4, bestWinStreak: 4 };
            const battle = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: hotUser.id,
                        teamId: null,
                        user: { ...hotUser, clan: null },
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
                .mockResolvedValueOnce(battle)
                .mockResolvedValueOnce({
                    ...battle,
                    status: BattleStatus.COMPLETED,
                    winnerId: hotUser.id,
                });

            const txCalls: { method: string; args: any }[] = [];
            prisma.$transaction.mockImplementation(async (callback) => {
                const mockTx = {
                    battle: { update: jest.fn().mockResolvedValue({}) },
                    battleParticipant: { update: jest.fn().mockResolvedValue({}) },
                    user: {
                        update: jest.fn().mockImplementation((args) => {
                            txCalls.push({ method: 'user.update', args });
                            return Promise.resolve({});
                        }),
                    },
                    clan: { update: jest.fn().mockResolvedValue({}) },
                };
                return callback(mockTx);
            });

            await service.completeBattle(mockBattle.id);

            const winnerUpdate = txCalls.find(
                c => c.method === 'user.update' && c.args.where.id === hotUser.id,
            );
            expect(winnerUpdate).toBeDefined();
            // 4 + 1 = 5, which surpasses bestWinStreak: 4.
            expect(winnerUpdate!.args.data.currentWinStreak).toBe(5);
            expect(winnerUpdate!.args.data.bestWinStreak).toBe(5);
        });

        it('runs achievement checks once per participant with the right context', async () => {
            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                startedAt: new Date('2024-01-01T10:00:00Z'),
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        teamId: null,
                        language: 'python',
                        user: { ...mockUser1, clan: null },
                        testsPassed: 10,
                        totalTests: 10,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:01:00Z'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        language: 'javascript',
                        user: { ...mockUser2, clan: null },
                        testsPassed: 4,
                        totalTests: 10,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:01:30Z'),
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
            prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

            await service.completeBattle(mockBattle.id);

            expect(achievementsService.runChecks).toHaveBeenCalledTimes(2);
            const calls = achievementsService.runChecks.mock.calls;
            const winnerCall = calls.find(
                (c) => c[0].userId === mockUser1.id,
            )?.[0];
            const loserCall = calls.find(
                (c) => c[0].userId === mockUser2.id,
            )?.[0];

            expect(winnerCall).toBeDefined();
            expect(winnerCall.battle.isWinner).toBe(true);
            expect(winnerCall.battle.mode).toBe(BattleMode.ONE_V_ONE);
            expect(winnerCall.battle.participant.language).toBe('python');
            expect(winnerCall.battle.participant.testsPassed).toBe(10);
            expect(winnerCall.battle.participant.totalTests).toBe(10);
            expect(winnerCall.battle.opponent).toEqual({
                preBattleMmr: mockUser2.mmr,
                testsPassed: 4,
                totalTests: 10,
            });
            // Wins increment for the winner
            expect(winnerCall.user.wins).toBe(mockUser1.wins + 1);
            expect(winnerCall.user.losses).toBe(mockUser1.losses);

            expect(loserCall).toBeDefined();
            expect(loserCall.battle.isWinner).toBe(false);
            expect(loserCall.user.wins).toBe(mockUser2.wins);
            expect(loserCall.user.losses).toBe(mockUser2.losses + 1);
        });

        it('completion succeeds even if achievement checks throw', async () => {
            achievementsService.runChecks.mockRejectedValueOnce(
                new Error('boom'),
            );
            const battleWithSubmissions = {
                ...mockBattle,
                status: BattleStatus.IN_PROGRESS,
                participants: [
                    {
                        id: 'p1',
                        userId: mockUser1.id,
                        teamId: null,
                        language: 'python',
                        user: { ...mockUser1, clan: null },
                        testsPassed: 10,
                        totalTests: 10,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:05'),
                        mmrChange: null,
                    },
                    {
                        id: 'p2',
                        userId: mockUser2.id,
                        teamId: null,
                        language: 'javascript',
                        user: { ...mockUser2, clan: null },
                        testsPassed: 1,
                        totalTests: 10,
                        pointsEarned: 0,
                        submittedAt: new Date('2024-01-01T10:00:10'),
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
            prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

            const result = await service.completeBattle(mockBattle.id);
            expect(result.status).toBe(BattleStatus.COMPLETED);
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

            // Hidden test cases must never leak through getBattleDetails:
            // BR / team modes display visible examples from this payload.
            expect(prisma.battle.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({
                        problem: expect.objectContaining({
                            select: expect.objectContaining({
                                testCases: { where: { isHidden: false } },
                            }),
                        }),
                        problemPool: expect.objectContaining({
                            include: expect.objectContaining({
                                items: expect.objectContaining({
                                    include: expect.objectContaining({
                                        problem: expect.objectContaining({
                                            select: expect.objectContaining({
                                                testCases: {
                                                    where: { isHidden: false },
                                                },
                                            }),
                                        }),
                                    }),
                                }),
                            }),
                        }),
                    }),
                }),
            );
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

        it('should update MMR and W/L for free users in completeBattle', async () => {
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

            const userUpdateCalls = txMock.user.update.mock.calls;
            const proUserUpdate = userUpdateCalls.find(
                (call) => call[0].where.id === proUser.id,
            );
            const freeUserUpdate = userUpdateCalls.find(
                (call) => call[0].where.id === freeUser.id,
            );

            expect(proUserUpdate).toBeDefined();
            expect(proUserUpdate![0].data).toEqual(
                expect.objectContaining({ mmr: expect.any(Number) }),
            );
            expect(freeUserUpdate).toBeDefined();
            expect(freeUserUpdate![0].data).toEqual(
                expect.objectContaining({
                    mmr: expect.any(Number),
                    wins: { increment: 1 },
                }),
            );
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

        it('should allow non-TIME_STEAL skills before passing a test case', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                enabledSkills: [SkillType.FREEZE, SkillType.TIME_STEAL],
                participants: mockBattleWithSkills.participants.map((p) =>
                    p.userId === 'user-1' ? { ...p, testsPassed: 0 } : p,
                ),
            });

            const mockSkillUse = {
                id: 'su-pre-unlock-freeze',
                battleId: 'battle-1',
                userId: 'user-1',
                targetUserId: 'user-2',
                skillType: SkillType.FREEZE,
                usedAt: new Date(),
            };
            prisma.battleSkillUse.create.mockResolvedValue(mockSkillUse);

            await expect(
                service.useSkill('battle-1', 'user-1', 'user-2', SkillType.FREEZE),
            ).resolves.toEqual(mockSkillUse);
        });

        it('should block TIME_STEAL before passing a test case', async () => {
            prisma.battle.findUnique.mockResolvedValue({
                ...mockBattleWithSkills,
                enabledSkills: [SkillType.FREEZE, SkillType.TIME_STEAL],
                participants: mockBattleWithSkills.participants.map((p) =>
                    p.userId === 'user-1' ? { ...p, testsPassed: 0 } : p,
                ),
            });

            await expect(
                service.useSkill(
                    'battle-1',
                    'user-1',
                    'user-2',
                    SkillType.TIME_STEAL,
                ),
            ).rejects.toThrow(
                /Time Steal unlocks after you pass at least one test case/,
            );
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
            // Default: the in-tx fresh read (post self-update) sees only
            // user-1 ready so by default we don't start the battle. Tests
            // that need the "all ready" case override this explicitly.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'user-1', isReady: true },
                { userId: 'user-2', isReady: false },
            ]);
        });

        it('should mark a participant as ready', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(twoPlayerBattle) // readyUp preflight
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
                .mockResolvedValueOnce(battleOneReady) // readyUp preflight
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
            // Fresh in-tx read: both participants ready now that user-2
            // just flipped. This is what drives the "start battle" branch.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'user-1', isReady: true },
                { userId: 'user-2', isReady: true },
            ]);
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
                .mockResolvedValueOnce(threePlayerBattle) // preflight
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
            // Fresh in-tx read: user-1 just readied but user-2 and user-3
            // are still not ready → no start.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'user-1', isReady: true },
                { userId: 'user-2', isReady: false },
                { userId: 'user-3', isReady: false },
            ]);

            const result = await service.readyUp('battle-1', 'user-1');

            expect(result.started).toBe(false);
            // Should NOT have updated battle status
            expect(prisma.battle.update).not.toHaveBeenCalled();
        });

        it('should execute readyUp within a transaction', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(twoPlayerBattle) // preflight
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

        // ============================================================
        // CLAN_WARS branch — lobby ready-up vs. intermission ready-up
        // ============================================================

        describe('CLAN_WARS branch', () => {
            const makeCwParticipant = (
                id: string,
                userId: string,
                teamId: 'team-1' | 'team-2',
                isReady = false,
            ) => ({
                id,
                battleId: 'battle-1',
                userId,
                teamId,
                code: null,
                language: null,
                testsPassed: 0,
                totalTests: 0,
                pointsEarned: 0,
                isReady,
                submittedAt: null,
                mmrChange: null,
            });

            // 2v2 full, balanced, everyone ready except user-1 → readying
            // user-1 in WAITING should flip allReady=true and delegate to
            // ClanWarsService.startClanWars (outside the tx).
            it('WAITING + full balanced 2v2: readying the last player starts Clan Wars via clanWarsService.startClanWars', async () => {
                const cwBattleWaiting = {
                    ...mockBattle,
                    mode: BattleMode.CLAN_WARS,
                    status: BattleStatus.WAITING,
                    isInIntermission: false,
                    teamSize: 2,
                    maxPlayers: 4,
                    participants: [
                        makeCwParticipant('p1', 'user-1', 'team-1', false),
                        makeCwParticipant('p2', 'user-2', 'team-1', true),
                        makeCwParticipant('p3', 'user-3', 'team-2', true),
                        makeCwParticipant('p4', 'user-4', 'team-2', true),
                    ],
                };

                prisma.battle.findUnique
                    .mockResolvedValueOnce(cwBattleWaiting) // preflight
                    .mockResolvedValueOnce(cwBattleWaiting) // tx lookup
                    .mockResolvedValueOnce({ // getBattleDetails
                        ...cwBattleWaiting,
                        status: BattleStatus.IN_PROGRESS,
                        startedAt: new Date(),
                        participants: cwBattleWaiting.participants.map((p) => ({
                            ...p,
                            isReady: true,
                            user: { ...mockUser1, id: p.userId, clan: null },
                        })),
                        problem: mockProblem,
                        skillUses: [],
                    });
                prisma.battleParticipant.update.mockResolvedValue({
                    ...cwBattleWaiting.participants[0],
                    isReady: true,
                });
                prisma.battleParticipant.findMany.mockResolvedValue([
                    { userId: 'user-1', isReady: true },
                    { userId: 'user-2', isReady: true },
                    { userId: 'user-3', isReady: true },
                    { userId: 'user-4', isReady: true },
                ]);

                const clanWarsService = (service as any)
                    .clanWarsService as { startClanWars: jest.Mock };

                const result = await service.readyUp('battle-1', 'user-1');

                expect(result.started).toBe(true);
                // CW path must NOT flip status inside the tx (start path
                // owns that race-safe flip) and must NOT bump games from
                // the lobby — startClanWars does both.
                expect(prisma.battle.update).not.toHaveBeenCalled();
                expect(
                    subscriptionsService.incrementGamesPlayed,
                ).not.toHaveBeenCalled();
                expect(clanWarsService.startClanWars).toHaveBeenCalledWith(
                    'battle-1',
                );
            });

            it('WAITING + CW lobby not full yet: rejects with "lobby is not full"', async () => {
                const cwBattleNotFull = {
                    ...mockBattle,
                    mode: BattleMode.CLAN_WARS,
                    status: BattleStatus.WAITING,
                    isInIntermission: false,
                    teamSize: 2,
                    maxPlayers: 4,
                    participants: [
                        makeCwParticipant('p1', 'user-1', 'team-1'),
                        makeCwParticipant('p2', 'user-2', 'team-1'),
                        makeCwParticipant('p3', 'user-3', 'team-2'),
                    ],
                };

                prisma.battle.findUnique
                    .mockResolvedValueOnce(cwBattleNotFull) // preflight
                    .mockResolvedValueOnce(cwBattleNotFull); // tx lookup

                await expect(
                    service.readyUp('battle-1', 'user-1'),
                ).rejects.toThrow(/lobby is not full/);
            });

            it('WAITING + CW unbalanced teams (3v1): rejects with "teams unbalanced"', async () => {
                const cwBattleUnbalanced = {
                    ...mockBattle,
                    mode: BattleMode.CLAN_WARS,
                    status: BattleStatus.WAITING,
                    isInIntermission: false,
                    teamSize: 2,
                    maxPlayers: 4,
                    participants: [
                        makeCwParticipant('p1', 'user-1', 'team-1'),
                        makeCwParticipant('p2', 'user-2', 'team-1'),
                        makeCwParticipant('p3', 'user-3', 'team-1'),
                        makeCwParticipant('p4', 'user-4', 'team-2'),
                    ],
                };

                prisma.battle.findUnique
                    .mockResolvedValueOnce(cwBattleUnbalanced) // preflight
                    .mockResolvedValueOnce(cwBattleUnbalanced); // tx lookup

                await expect(
                    service.readyUp('battle-1', 'user-1'),
                ).rejects.toThrow(/teams unbalanced/);
            });

            it('IN_PROGRESS + isInIntermission: delegates to clanWarsService.readyForNextRound and does NOT enter the WAITING tx', async () => {
                const cwBattleInIntermission = {
                    ...mockBattle,
                    mode: BattleMode.CLAN_WARS,
                    status: BattleStatus.IN_PROGRESS,
                    isInIntermission: true,
                    teamSize: 2,
                    maxPlayers: 4,
                    participants: [
                        makeCwParticipant('p1', 'user-1', 'team-1', false),
                        makeCwParticipant('p2', 'user-2', 'team-1', true),
                        makeCwParticipant('p3', 'user-3', 'team-2', true),
                        makeCwParticipant('p4', 'user-4', 'team-2', true),
                    ],
                };

                prisma.battle.findUnique
                    .mockResolvedValueOnce(cwBattleInIntermission) // preflight
                    .mockResolvedValueOnce({ // getBattleDetails
                        ...cwBattleInIntermission,
                        participants: cwBattleInIntermission.participants.map(
                            (p) => ({
                                ...p,
                                user: {
                                    ...mockUser1,
                                    id: p.userId,
                                    clan: null,
                                },
                            }),
                        ),
                        problem: mockProblem,
                        skillUses: [],
                    });

                const clanWarsService = (service as any)
                    .clanWarsService as {
                    readyForNextRound: jest.Mock;
                    startClanWars: jest.Mock;
                };
                clanWarsService.readyForNextRound.mockResolvedValueOnce({
                    allReady: true,
                });

                const result = await service.readyUp('battle-1', 'user-1');

                expect(result.started).toBe(true);
                expect(
                    clanWarsService.readyForNextRound,
                ).toHaveBeenCalledWith('battle-1', 'user-1');
                // Crucially: the intermission path must NOT fall through to
                // the WAITING transaction and must NOT call startClanWars.
                expect(prisma.$transaction).not.toHaveBeenCalled();
                expect(clanWarsService.startClanWars).not.toHaveBeenCalled();
            });

            it('IN_PROGRESS + NOT in intermission: falls through and rejects with "not in waiting state"', async () => {
                const cwBattleMidRound = {
                    ...mockBattle,
                    mode: BattleMode.CLAN_WARS,
                    status: BattleStatus.IN_PROGRESS,
                    isInIntermission: false,
                    teamSize: 2,
                    maxPlayers: 4,
                    participants: [
                        makeCwParticipant('p1', 'user-1', 'team-1'),
                        makeCwParticipant('p2', 'user-2', 'team-1'),
                        makeCwParticipant('p3', 'user-3', 'team-2'),
                        makeCwParticipant('p4', 'user-4', 'team-2'),
                    ],
                };

                prisma.battle.findUnique
                    .mockResolvedValueOnce(cwBattleMidRound) // preflight
                    .mockResolvedValueOnce(cwBattleMidRound); // tx lookup

                const clanWarsService = (service as any)
                    .clanWarsService as { readyForNextRound: jest.Mock };

                await expect(
                    service.readyUp('battle-1', 'user-1'),
                ).rejects.toThrow(/not in waiting state/);
                expect(
                    clanWarsService.readyForNextRound,
                ).not.toHaveBeenCalled();
            });
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
                .mockResolvedValueOnce(battle) // preflight
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
            // Fresh in-tx read: both BR participants now ready.
            prisma.battleParticipant.findMany.mockResolvedValue([
                { userId: 'user-1', isReady: true },
                { userId: 'user-2', isReady: true },
            ]);

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

    // ==========================================
    // Stale battle cleanup
    // ==========================================
    describe('stale battle cleanup', () => {
        const TIME_LIMIT = 5; // minutes
        // The implementation adds a 30s grace. Comfortably past the deadline.
        const longAgo = new Date(Date.now() - (TIME_LIMIT * 60_000 + 120_000));
        const recent = new Date(Date.now() - 10_000);

        it('finalizeStaleBattlesForUser finalizes expired IN_PROGRESS battles', async () => {
            // First findMany call = IN_PROGRESS scan; second = WAITING scan.
            prisma.battle.findMany
                .mockResolvedValueOnce([
                    { id: 'stale-1', startedAt: longAgo, timeLimitMinutes: TIME_LIMIT },
                ])
                .mockResolvedValueOnce([]);

            const completeSpy = jest
                .spyOn(service, 'completeBattle')
                .mockResolvedValue({ id: 'stale-1' } as any);

            const changed = await service.finalizeStaleBattlesForUser('user-1');

            expect(changed).toBe(1);
            expect(completeSpy).toHaveBeenCalledWith('stale-1');
        });

        it('finalizeStaleBattlesForUser skips fresh IN_PROGRESS battles', async () => {
            // Battle still within time limit — should NOT be finalized.
            prisma.battle.findMany
                .mockResolvedValueOnce([
                    { id: 'fresh-1', startedAt: recent, timeLimitMinutes: TIME_LIMIT },
                ])
                .mockResolvedValueOnce([]);

            const completeSpy = jest
                .spyOn(service, 'completeBattle')
                .mockResolvedValue({} as any);

            const changed = await service.finalizeStaleBattlesForUser('user-1');

            expect(changed).toBe(0);
            expect(completeSpy).not.toHaveBeenCalled();
        });

        it('finalizeStaleBattlesForUser expires stale WAITING lobbies', async () => {
            prisma.battle.findMany
                .mockResolvedValueOnce([]) // no IN_PROGRESS
                .mockResolvedValueOnce([{ id: 'waiting-1' }]);

            const completeSpy = jest
                .spyOn(service, 'completeBattle')
                .mockResolvedValue({ id: 'waiting-1' } as any);

            const changed = await service.finalizeStaleBattlesForUser('user-1');

            expect(changed).toBe(1);
            expect(completeSpy).toHaveBeenCalledWith('waiting-1');
        });

        it('finalizeStaleBattlesForUser swallows "already completed" races', async () => {
            prisma.battle.findMany
                .mockResolvedValueOnce([
                    { id: 'racy-1', startedAt: longAgo, timeLimitMinutes: TIME_LIMIT },
                ])
                .mockResolvedValueOnce([]);

            // Another path completed the battle between the scan and our
            // finalize call — completeBattle throws "already completed".
            jest.spyOn(service, 'completeBattle').mockRejectedValue(
                new BadRequestException('Battle is already completed'),
            );

            const changed = await service.finalizeStaleBattlesForUser('user-1');

            expect(changed).toBe(0); // not counted, but also not rethrown
        });

        it('cleanupStaleBattles runs both sweeps globally', async () => {
            prisma.battle.findMany
                .mockResolvedValueOnce([
                    { id: 'stale-1', startedAt: longAgo, timeLimitMinutes: TIME_LIMIT },
                ])
                .mockResolvedValueOnce([{ id: 'waiting-1' }]);

            const completeSpy = jest
                .spyOn(service, 'completeBattle')
                .mockResolvedValue({} as any);

            await service.cleanupStaleBattles();

            expect(completeSpy).toHaveBeenCalledWith('stale-1');
            expect(completeSpy).toHaveBeenCalledWith('waiting-1');
        });

        it('forceFinalizeActiveBattlesForUser finalizes ALL active battles regardless of age', async () => {
            // Fresh IN_PROGRESS battle (started 10s ago — well within time
            // limit). The age-gated `finalizeStaleBattlesForUser` would skip
            // this; the force variant must finalize it anyway.
            prisma.battle.findMany.mockResolvedValueOnce([
                { id: 'fresh-1' },
                { id: 'waiting-1' },
            ]);

            const completeSpy = jest
                .spyOn(service, 'completeBattle')
                .mockResolvedValue({} as any);

            const changed =
                await service.forceFinalizeActiveBattlesForUser('user-1');

            expect(changed).toBe(2);
            expect(completeSpy).toHaveBeenCalledWith('fresh-1');
            expect(completeSpy).toHaveBeenCalledWith('waiting-1');
        });

        it('forceFinalizeActiveBattlesForUser swallows races on already-completed battles', async () => {
            prisma.battle.findMany.mockResolvedValueOnce([{ id: 'racy-1' }]);

            jest.spyOn(service, 'completeBattle').mockRejectedValue(
                new BadRequestException('Battle is already completed'),
            );

            const changed =
                await service.forceFinalizeActiveBattlesForUser('user-1');

            expect(changed).toBe(0);
        });
    });

    // ==========================================
    // Rematch
    // ==========================================
    describe('createRematch', () => {
        const baseOriginal = {
            id: 'orig-1',
            mode: BattleMode.ONE_V_ONE,
            status: BattleStatus.COMPLETED,
            problemId: 'problem-1',
            teamSize: null,
            timeLimitMinutes: 5,
            autoBalance: false,
            enabledSkills: [],
            problem: { testCases: [{ id: 't1' }, { id: 't2' }] },
            problemPool: null,
            participants: [
                { userId: 'user-1', teamId: null },
                { userId: 'user-2', teamId: null },
            ],
        } as any;

        it('returns the existing rematch when one is already in WAITING — both clicks land on the same battle', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(baseOriginal) // original lookup
                .mockResolvedValueOnce({ id: 'rematch-1', participants: [] }); // getBattleDetails

            prisma.battle.findFirst.mockResolvedValueOnce({
                id: 'rematch-1',
                rematchOfBattleId: 'orig-1',
                status: BattleStatus.WAITING,
                createdAt: new Date(),
            });

            const result = await service.createRematch('user-2', 'orig-1');

            expect(prisma.battle.create).not.toHaveBeenCalled();
            expect(result.id).toBe('rematch-1');
            expect(battlesGateway.emitBattleRematchCreated).toHaveBeenCalledWith(
                ['user-1', 'user-2'],
                expect.objectContaining({
                    originalBattleId: 'orig-1',
                    rematchBattleId: 'rematch-1',
                    initiatedByUserId: 'user-2',
                }),
            );
        });

        it('creates a new rematch and emits to all participants', async () => {
            prisma.battle.findUnique
                .mockResolvedValueOnce(baseOriginal)
                .mockResolvedValueOnce({ id: 'rematch-new', participants: [] });

            prisma.battle.findFirst.mockResolvedValueOnce(null);
            prisma.battle.create.mockResolvedValueOnce({ id: 'rematch-new' });

            await service.createRematch('user-1', 'orig-1');

            expect(prisma.battle.create).toHaveBeenCalledTimes(1);
            expect(battlesGateway.emitBattleRematchCreated).toHaveBeenCalledWith(
                ['user-1', 'user-2'],
                expect.objectContaining({
                    originalBattleId: 'orig-1',
                    rematchBattleId: 'rematch-new',
                    initiatedByUserId: 'user-1',
                }),
            );
        });
    });
});
