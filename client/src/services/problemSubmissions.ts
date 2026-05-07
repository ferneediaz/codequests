import api from './api';
import type { SubmissionResult } from '@/types/api';
import type {
    AdminSubmissionListResponse,
    CreateSubmissionPayload,
    ProblemSubmission,
    SubmissionStatus,
} from '@/types/submission';

export const problemSubmissionsApi = {
    async create(payload: CreateSubmissionPayload): Promise<ProblemSubmission> {
        const { data } = await api.post<ProblemSubmission>(
            '/problem-submissions',
            payload,
        );
        return data;
    },

    async listMine(): Promise<ProblemSubmission[]> {
        const { data } = await api.get<ProblemSubmission[]>(
            '/problem-submissions/mine',
        );
        return data;
    },

    async getOne(id: string): Promise<ProblemSubmission> {
        const { data } = await api.get<ProblemSubmission>(
            `/problem-submissions/${id}`,
        );
        return data;
    },

    async updateOwn(
        id: string,
        payload: CreateSubmissionPayload,
    ): Promise<ProblemSubmission> {
        const { data } = await api.patch<ProblemSubmission>(
            `/problem-submissions/${id}`,
            payload,
        );
        return data;
    },

    async listForReview(params: {
        status?: SubmissionStatus;
        search?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<AdminSubmissionListResponse> {
        const { data } = await api.get<AdminSubmissionListResponse>(
            '/admin/problem-submissions',
            { params },
        );
        return data;
    },

    async dryRun(id: string, language: string): Promise<SubmissionResult> {
        const { data } = await api.post<SubmissionResult>(
            `/admin/problem-submissions/${id}/dry-run`,
            { language },
        );
        return data;
    },

    async approve(
        id: string,
        body: { notes?: string; edits?: CreateSubmissionPayload } = {},
    ): Promise<{ submission: ProblemSubmission; problem: { id: string } }> {
        const { data } = await api.post<{
            submission: ProblemSubmission;
            problem: { id: string };
        }>(`/admin/problem-submissions/${id}/approve`, body);
        return data;
    },

    async reject(id: string, notes: string): Promise<ProblemSubmission> {
        const { data } = await api.post<ProblemSubmission>(
            `/admin/problem-submissions/${id}/reject`,
            { notes },
        );
        return data;
    },

    async requestChanges(id: string, notes: string): Promise<ProblemSubmission> {
        const { data } = await api.post<ProblemSubmission>(
            `/admin/problem-submissions/${id}/request-changes`,
            { notes },
        );
        return data;
    },
};
