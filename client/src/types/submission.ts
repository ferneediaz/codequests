import type { Difficulty } from './common';

export type SubmissionStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'REJECTED'
    | 'NEEDS_CHANGES';

export interface SubmissionUserSummary {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface SubmissionLinkedProblem {
    id: string;
    title: string;
}

export interface ProblemSubmission {
    id: string;
    submittedById: string;
    submittedBy?: SubmissionUserSummary;
    title: string;
    description: string;
    difficulty: Difficulty;
    tags: string[];
    starterCode: Record<string, string>;
    signature: Record<string, unknown>;
    tests: Array<{ args: unknown[]; expected: unknown; hidden?: boolean }>;
    hints: string[];
    solution: string;
    referenceCode: Record<string, string>;
    status: SubmissionStatus;
    reviewerId: string | null;
    reviewer?: SubmissionUserSummary | null;
    reviewNotes: string | null;
    reviewedAt: string | null;
    linkedProblemId: string | null;
    linkedProblem?: SubmissionLinkedProblem | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSubmissionPayload {
    title: string;
    description: string;
    difficulty: Difficulty;
    tags?: string[];
    signature: Record<string, unknown>;
    referenceCode: Record<string, string>;
    tests: Array<{ args: unknown[]; expected: unknown; hidden?: boolean }>;
    hints: string[];
    solution: string;
}

export interface AdminSubmissionListResponse {
    items: ProblemSubmission[];
    total: number;
    page: number;
    limit: number;
}
