import type { Difficulty, ProblemResponse, SubmissionResult } from './api';

export type PracticeLanguage = 'javascript' | 'python';

export interface PracticeProblemSummary {
    id: string;
    title: string;
    difficulty: Difficulty;
    tags: string[];
    solved: boolean;
    attempts: number;
}

/**
 * Practice-only problem payload returned by `GET /practice/problems/:id`.
 * Mirrors `ProblemResponse` (shared with battle flows) and adds the
 * `hints` + `solution` fields that are intentionally stripped from the
 * generic `/problems/:id` endpoint.
 */
export interface PracticeProblemDetail extends ProblemResponse {
    tags: string[];
    hints: string[];
    solution: string;
}

export interface PracticeSubmitRequest {
    problemId: string;
    code: string;
    language: PracticeLanguage;
}

export interface PracticeSubmitResponse extends SubmissionResult {
    saved: boolean;
}

export interface TopicStat {
    tag: string;
    solved: number;
    attempts: number;
}

export interface PracticeStats {
    totalAttempts: number;
    totalSolved: number;
    solveRate: number;
    topics: TopicStat[];
    byDifficulty: { EASY: number; MEDIUM: number; HARD: number };
    isTracked: boolean;
}

export interface PracticeAttemptRecord {
    id: string;
    userId: string;
    problemId: string;
    language: PracticeLanguage;
    code: string;
    passed: boolean;
    testsPassed: number;
    totalTests: number;
    attemptedAt: string;
    problem?: {
        id: string;
        title: string;
        difficulty: Difficulty;
        tags: string[];
    };
}

export interface PracticeAttemptsResponse {
    data: PracticeAttemptRecord[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
