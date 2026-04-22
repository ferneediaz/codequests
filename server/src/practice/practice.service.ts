import { Injectable, NotFoundException } from '@nestjs/common';
import { Difficulty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    CodeExecutionService,
    ExecutionResult,
} from '../code-execution/code-execution.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SupportedLanguage } from './dto/submit-attempt.dto';
import {
    DifficultyStatsDto,
    PracticeStatsDto,
    TopicStatDto,
} from './dto/practice-stats.dto';

export interface SubmitAttemptResult extends ExecutionResult {
    saved: boolean;
}

@Injectable()
export class PracticeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly codeExecution: CodeExecutionService,
        private readonly subscriptions: SubscriptionsService,
    ) { }

    /**
     * Run the submitted code against every test case and, for PRO/trial users,
     * persist an attempt record. FREE users receive the same feedback but nothing
     * is saved.
     */
    async submitAttempt(
        userId: string,
        problemId: string,
        code: string,
        language: SupportedLanguage,
    ): Promise<SubmitAttemptResult> {
        const problem = await this.prisma.problem.findUnique({
            where: { id: problemId },
            select: { id: true },
        });
        if (!problem) {
            throw new NotFoundException(`Problem ${problemId} not found`);
        }

        const execution = await this.codeExecution.executeCode(
            problemId,
            code,
            language,
        );

        const isTracked = await this.isTrackedUser(userId);

        if (isTracked) {
            await this.prisma.practiceAttempt.create({
                data: {
                    userId,
                    problemId,
                    language,
                    code,
                    passed: execution.allPassed,
                    testsPassed: execution.passed,
                    totalTests: execution.total,
                },
            });
        }

        return { ...execution, saved: isTracked };
    }

    /**
     * List a user's attempts, paginated and optionally filtered by problem.
     */
    async getMyAttempts(
        userId: string,
        options: { problemId?: string; page?: number; limit?: number } = {},
    ) {
        const page = Math.max(1, options.page ?? 1);
        const limit = Math.min(100, Math.max(1, options.limit ?? 20));
        const skip = (page - 1) * limit;

        const where = {
            userId,
            ...(options.problemId ? { problemId: options.problemId } : {}),
        };

        const [items, total] = await Promise.all([
            this.prisma.practiceAttempt.findMany({
                where,
                orderBy: { attemptedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    problem: {
                        select: {
                            id: true,
                            title: true,
                            difficulty: true,
                            tags: true,
                        },
                    },
                },
            }),
            this.prisma.practiceAttempt.count({ where }),
        ]);

        return {
            data: items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get the set of problem IDs the user has solved at least once.
     */
    async getSolvedProblemIds(userId: string): Promise<Set<string>> {
        const rows = await this.prisma.practiceAttempt.findMany({
            where: { userId, passed: true },
            select: { problemId: true },
            distinct: ['problemId'],
        });
        return new Set(rows.map((r) => r.problemId));
    }

    /**
     * Aggregate stats for the profile view. FREE users get an empty (untracked)
     * payload — mirrors what's stored in the DB.
     */
    async getMyStats(userId: string): Promise<PracticeStatsDto> {
        const isTracked = await this.isTrackedUser(userId);

        if (!isTracked) {
            return this.emptyStats(false);
        }

        const attempts = await this.prisma.practiceAttempt.findMany({
            where: { userId },
            select: {
                passed: true,
                problemId: true,
                problem: {
                    select: { difficulty: true, tags: true },
                },
            },
        });

        if (attempts.length === 0) {
            return this.emptyStats(true);
        }

        const totalAttempts = attempts.length;
        const passedAttempts = attempts.filter((a) => a.passed).length;
        const solveRate = (passedAttempts / totalAttempts) * 100;

        const solvedProblemIds = new Set<string>();
        for (const a of attempts) {
            if (a.passed) solvedProblemIds.add(a.problemId);
        }

        const byDifficulty: DifficultyStatsDto = { EASY: 0, MEDIUM: 0, HARD: 0 };
        const seenForDifficulty = new Set<string>();
        for (const a of attempts) {
            if (!a.passed) continue;
            if (seenForDifficulty.has(a.problemId)) continue;
            seenForDifficulty.add(a.problemId);
            const diff = a.problem.difficulty as Difficulty;
            byDifficulty[diff] += 1;
        }

        const topicAttempts = new Map<string, number>();
        const topicSolvedProblems = new Map<string, Set<string>>();
        for (const a of attempts) {
            for (const tag of a.problem.tags ?? []) {
                topicAttempts.set(tag, (topicAttempts.get(tag) ?? 0) + 1);
                if (a.passed) {
                    if (!topicSolvedProblems.has(tag)) {
                        topicSolvedProblems.set(tag, new Set());
                    }
                    topicSolvedProblems.get(tag)!.add(a.problemId);
                }
            }
        }

        const topics: TopicStatDto[] = Array.from(topicAttempts.entries())
            .map(([tag, attemptsCount]) => ({
                tag,
                attempts: attemptsCount,
                solved: topicSolvedProblems.get(tag)?.size ?? 0,
            }))
            .sort((a, b) => b.attempts - a.attempts);

        return {
            totalAttempts,
            totalSolved: solvedProblemIds.size,
            solveRate: Math.round(solveRate * 10) / 10,
            topics,
            byDifficulty,
            isTracked: true,
        };
    }

    /**
     * Return all problems with per-user solved/attempt counters. FREE users get
     * problems with solved=false, attempts=0 regardless.
     */
    async listProblems(
        userId: string,
        options: {
            difficulty?: Difficulty;
            tags?: string[];
            unsolvedOnly?: boolean;
        } = {},
    ) {
        const where: {
            difficulty?: Difficulty;
            tags?: { hasSome: string[] };
        } = {};
        if (options.difficulty) where.difficulty = options.difficulty;
        if (options.tags && options.tags.length > 0) {
            where.tags = { hasSome: options.tags };
        }

        const problems = await this.prisma.problem.findMany({
            where,
            orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                title: true,
                difficulty: true,
                tags: true,
            },
        });

        const isTracked = await this.isTrackedUser(userId);

        if (!isTracked) {
            const list = problems.map((p) => ({
                ...p,
                solved: false,
                attempts: 0,
            }));
            if (options.unsolvedOnly) return list;
            return list;
        }

        const attemptsByProblem = await this.prisma.practiceAttempt.groupBy({
            by: ['problemId', 'passed'],
            where: { userId },
            _count: { _all: true },
        });

        const attemptsMap = new Map<string, number>();
        const solvedSet = new Set<string>();
        for (const row of attemptsByProblem) {
            const count = row._count?._all ?? 0;
            attemptsMap.set(
                row.problemId,
                (attemptsMap.get(row.problemId) ?? 0) + count,
            );
            if (row.passed) solvedSet.add(row.problemId);
        }

        const list = problems.map((p) => ({
            ...p,
            solved: solvedSet.has(p.id),
            attempts: attemptsMap.get(p.id) ?? 0,
        }));

        if (options.unsolvedOnly) {
            return list.filter((p) => !p.solved);
        }
        return list;
    }

    /**
     * PRO tier OR an active trial means we record per-attempt data.
     */
    private async isTrackedUser(userId: string): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, trialEndsAt: true },
        });
        if (!user) {
            throw new NotFoundException(`User ${userId} not found`);
        }
        if (user.subscriptionTier === 'PRO') return true;
        return this.subscriptions.isTrialActive(user.trialEndsAt);
    }

    private emptyStats(isTracked: boolean): PracticeStatsDto {
        return {
            totalAttempts: 0,
            totalSolved: 0,
            solveRate: 0,
            topics: [],
            byDifficulty: { EASY: 0, MEDIUM: 0, HARD: 0 },
            isTracked,
        };
    }
}
