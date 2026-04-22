import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Difficulty } from '@prisma/client';
import { PracticeService } from './practice.service';
import { PrismaService } from '../prisma/prisma.service';
import { CodeExecutionService } from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';

describe('PracticeService', () => {
    let service: PracticeService;
    let prisma: MockPrismaService;
    let codeExecution: { executeCode: jest.Mock };
    let subscriptions: { isTrialActive: jest.Mock };

    beforeEach(async () => {
        prisma = createMockPrismaService();
        codeExecution = { executeCode: jest.fn() };
        subscriptions = { isTrialActive: jest.fn().mockReturnValue(false) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PracticeService,
                { provide: PrismaService, useValue: prisma },
                { provide: CodeExecutionService, useValue: codeExecution },
                { provide: SubscriptionsService, useValue: subscriptions },
            ],
        }).compile();

        service = module.get(PracticeService);
    });

    describe('submitAttempt', () => {
        const problemId = 'problem-1';
        const userId = 'user-1';

        beforeEach(() => {
            prisma.problem.findUnique.mockResolvedValue({ id: problemId });
            codeExecution.executeCode.mockResolvedValue({
                passed: 3,
                total: 5,
                allPassed: false,
                results: [],
            });
        });

        it('throws NotFoundException when problem does not exist', async () => {
            prisma.problem.findUnique.mockResolvedValue(null);
            await expect(
                service.submitAttempt(userId, 'missing', 'code', 'javascript'),
            ).rejects.toThrow(NotFoundException);
            expect(codeExecution.executeCode).not.toHaveBeenCalled();
        });

        it('does NOT persist for FREE users and returns saved=false', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'FREE',
                trialEndsAt: null,
            });

            const result = await service.submitAttempt(
                userId,
                problemId,
                'code',
                'javascript',
            );

            expect(prisma.practiceAttempt.create).not.toHaveBeenCalled();
            expect(result.saved).toBe(false);
            expect(result.passed).toBe(3);
            expect(result.total).toBe(5);
            expect(result.allPassed).toBe(false);
        });

        it('persists for PRO users and returns saved=true', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });

            const result = await service.submitAttempt(
                userId,
                problemId,
                'code',
                'python',
            );

            expect(prisma.practiceAttempt.create).toHaveBeenCalledWith({
                data: {
                    userId,
                    problemId,
                    language: 'python',
                    code: 'code',
                    passed: false,
                    testsPassed: 3,
                    totalTests: 5,
                },
            });
            expect(result.saved).toBe(true);
        });

        it('persists for trial-active users', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'FREE',
                trialEndsAt: new Date(Date.now() + 86400000),
            });
            subscriptions.isTrialActive.mockReturnValue(true);

            const result = await service.submitAttempt(
                userId,
                problemId,
                'code',
                'javascript',
            );

            expect(prisma.practiceAttempt.create).toHaveBeenCalled();
            expect(result.saved).toBe(true);
        });

        it('records passed=true when all tests pass', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });
            codeExecution.executeCode.mockResolvedValue({
                passed: 5,
                total: 5,
                allPassed: true,
                results: [],
            });

            const result = await service.submitAttempt(
                userId,
                problemId,
                'code',
                'javascript',
            );

            expect(prisma.practiceAttempt.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        passed: true,
                        testsPassed: 5,
                        totalTests: 5,
                    }),
                }),
            );
            expect(result.allPassed).toBe(true);
            expect(result.saved).toBe(true);
        });
    });

    describe('getMyAttempts', () => {
        it('returns paginated attempts with defaults', async () => {
            prisma.practiceAttempt.findMany.mockResolvedValue([{ id: 'a' }]);
            prisma.practiceAttempt.count.mockResolvedValue(1);

            const out = await service.getMyAttempts('user-1');

            expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                    skip: 0,
                    take: 20,
                }),
            );
            expect(out.meta).toEqual({
                total: 1,
                page: 1,
                limit: 20,
                totalPages: 1,
            });
        });

        it('filters by problemId when provided', async () => {
            prisma.practiceAttempt.findMany.mockResolvedValue([]);
            prisma.practiceAttempt.count.mockResolvedValue(0);

            await service.getMyAttempts('user-1', {
                problemId: 'problem-1',
                page: 2,
                limit: 5,
            });

            expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1', problemId: 'problem-1' },
                    skip: 5,
                    take: 5,
                }),
            );
        });

        it('caps limit at 100', async () => {
            prisma.practiceAttempt.findMany.mockResolvedValue([]);
            prisma.practiceAttempt.count.mockResolvedValue(0);

            await service.getMyAttempts('user-1', { limit: 500 });

            expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 100 }),
            );
        });
    });

    describe('getSolvedProblemIds', () => {
        it('returns a set of distinct problem ids where user passed', async () => {
            prisma.practiceAttempt.findMany.mockResolvedValue([
                { problemId: 'p1' },
                { problemId: 'p2' },
            ]);

            const solved = await service.getSolvedProblemIds('user-1');

            expect(prisma.practiceAttempt.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1', passed: true },
                    distinct: ['problemId'],
                }),
            );
            expect(solved).toEqual(new Set(['p1', 'p2']));
        });
    });

    describe('getMyStats', () => {
        it('returns empty untracked stats for FREE users', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'FREE',
                trialEndsAt: null,
            });

            const stats = await service.getMyStats('user-1');

            expect(stats.isTracked).toBe(false);
            expect(stats.totalAttempts).toBe(0);
            expect(stats.topics).toEqual([]);
            expect(prisma.practiceAttempt.findMany).not.toHaveBeenCalled();
        });

        it('returns empty tracked stats for PRO users with no attempts', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });
            prisma.practiceAttempt.findMany.mockResolvedValue([]);

            const stats = await service.getMyStats('user-1');

            expect(stats.isTracked).toBe(true);
            expect(stats.totalAttempts).toBe(0);
        });

        it('aggregates topics, difficulty, and solve rate', async () => {
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });
            prisma.practiceAttempt.findMany.mockResolvedValue([
                {
                    passed: true,
                    problemId: 'p1',
                    problem: {
                        difficulty: Difficulty.EASY,
                        tags: ['arrays', 'hash-table'],
                    },
                },
                {
                    passed: false,
                    problemId: 'p1',
                    problem: {
                        difficulty: Difficulty.EASY,
                        tags: ['arrays', 'hash-table'],
                    },
                },
                {
                    passed: true,
                    problemId: 'p2',
                    problem: {
                        difficulty: Difficulty.MEDIUM,
                        tags: ['arrays'],
                    },
                },
                {
                    passed: false,
                    problemId: 'p3',
                    problem: {
                        difficulty: Difficulty.HARD,
                        tags: ['strings'],
                    },
                },
            ]);

            const stats = await service.getMyStats('user-1');

            expect(stats.isTracked).toBe(true);
            expect(stats.totalAttempts).toBe(4);
            expect(stats.totalSolved).toBe(2);
            expect(stats.solveRate).toBe(50);
            expect(stats.byDifficulty).toEqual({
                EASY: 1,
                MEDIUM: 1,
                HARD: 0,
            });
            const arrays = stats.topics.find((t) => t.tag === 'arrays');
            expect(arrays).toEqual({ tag: 'arrays', solved: 2, attempts: 3 });
            const strings = stats.topics.find((t) => t.tag === 'strings');
            expect(strings).toEqual({ tag: 'strings', solved: 0, attempts: 1 });
        });

        it('throws NotFoundException when user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(service.getMyStats('missing')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('listProblems', () => {
        const problems = [
            { id: 'p1', title: 'A', difficulty: Difficulty.EASY, tags: ['arrays'] },
            { id: 'p2', title: 'B', difficulty: Difficulty.MEDIUM, tags: ['strings'] },
        ];

        it('returns problems with zero counters for FREE users', async () => {
            prisma.problem.findMany.mockResolvedValue(problems);
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'FREE',
                trialEndsAt: null,
            });

            const result = await service.listProblems('user-1');

            expect(result).toHaveLength(2);
            expect(result[0]).toMatchObject({ id: 'p1', solved: false, attempts: 0 });
            expect(prisma.practiceAttempt.groupBy).not.toHaveBeenCalled();
        });

        it('enriches with solved + attempt counts for PRO users', async () => {
            prisma.problem.findMany.mockResolvedValue(problems);
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });
            prisma.practiceAttempt.groupBy.mockResolvedValue([
                { problemId: 'p1', passed: true, _count: { _all: 2 } },
                { problemId: 'p1', passed: false, _count: { _all: 3 } },
            ]);

            const result = await service.listProblems('user-1');

            const p1 = result.find((p) => p.id === 'p1');
            const p2 = result.find((p) => p.id === 'p2');
            expect(p1).toMatchObject({ id: 'p1', solved: true, attempts: 5 });
            expect(p2).toMatchObject({ id: 'p2', solved: false, attempts: 0 });
        });

        it('filters unsolved only', async () => {
            prisma.problem.findMany.mockResolvedValue(problems);
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'PRO',
                trialEndsAt: null,
            });
            prisma.practiceAttempt.groupBy.mockResolvedValue([
                { problemId: 'p1', passed: true, _count: { _all: 1 } },
            ]);

            const result = await service.listProblems('user-1', {
                unsolvedOnly: true,
            });

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p2');
        });

        it('forwards difficulty + tag filters to prisma', async () => {
            prisma.problem.findMany.mockResolvedValue([]);
            prisma.user.findUnique.mockResolvedValue({
                subscriptionTier: 'FREE',
                trialEndsAt: null,
            });

            await service.listProblems('user-1', {
                difficulty: Difficulty.HARD,
                tags: ['arrays', 'dp'],
            });

            expect(prisma.problem.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        difficulty: Difficulty.HARD,
                        tags: { hasSome: ['arrays', 'dp'] },
                    },
                }),
            );
        });
    });
});
