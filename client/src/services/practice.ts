import api from './api';
import type { Difficulty } from '@/types/api';
import type {
    PracticeAttemptsResponse,
    PracticeProblemSummary,
    PracticeStats,
    PracticeSubmitRequest,
    PracticeSubmitResponse,
} from '@/types/practice';

export interface ListPracticeProblemsParams {
    difficulty?: Difficulty;
    tags?: string[];
    unsolvedOnly?: boolean;
}

export const practiceApi = {
    async listProblems(
        params: ListPracticeProblemsParams = {},
    ): Promise<PracticeProblemSummary[]> {
        const { data } = await api.get<PracticeProblemSummary[]>(
            '/practice/problems',
            {
                params: {
                    difficulty: params.difficulty,
                    tags: params.tags?.length ? params.tags.join(',') : undefined,
                    unsolvedOnly: params.unsolvedOnly ? 'true' : undefined,
                },
            },
        );
        return data;
    },

    async submitAttempt(
        payload: PracticeSubmitRequest,
    ): Promise<PracticeSubmitResponse> {
        const { data } = await api.post<PracticeSubmitResponse>(
            '/practice/attempts',
            payload,
        );
        return data;
    },

    async getStats(): Promise<PracticeStats> {
        const { data } = await api.get<PracticeStats>('/practice/stats');
        return data;
    },

    async getAttempts(params: {
        problemId?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<PracticeAttemptsResponse> {
        const { data } = await api.get<PracticeAttemptsResponse>(
            '/practice/attempts',
            { params },
        );
        return data;
    },
};
