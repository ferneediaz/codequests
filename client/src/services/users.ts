import api from './api';
import type {
    GithubActivity,
    MatchHistoryEntry,
    NewsFilter,
    NewsResponse,
    ProblemContribution,
    PublicUser,
    UserStats,
} from '@/types/api';
import type { PracticeStats } from '@/types/practice';

export interface UserSearchResult {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    clanId?: string | null;
}

export async function searchUsers(
    q: string,
    limit = 10,
): Promise<UserSearchResult[]> {
    const { data } = await api.get<UserSearchResult[]>('/users/search', {
        params: { q, limit },
    });
    return data;
}

export const usersApi = {
    async getStats(userId: string): Promise<UserStats> {
        const { data } = await api.get<UserStats>(`/users/${userId}/stats`);
        return data;
    },

    async getMatchHistory(
        userId: string,
        params: { limit?: number } = {},
    ): Promise<MatchHistoryEntry[]> {
        const { data } = await api.get<MatchHistoryEntry[]>(
            `/users/${userId}/history`,
            {
                params: { limit: params.limit },
            },
        );
        return data;
    },

    async getNews(
        userId: string,
        params: {
            limit?: number;
            filter?: NewsFilter;
            before?: string;
        } = {},
    ): Promise<NewsResponse> {
        const { data } = await api.get<NewsResponse>(`/users/${userId}/news`, {
            params,
        });
        return data;
    },

    async getByUsername(username: string): Promise<PublicUser> {
        const { data } = await api.get<PublicUser>(
            `/users/username/${encodeURIComponent(username)}`,
        );
        return data;
    },

    async getGithubActivity(
        userId: string,
        year: string,
    ): Promise<GithubActivity> {
        const { data } = await api.get<GithubActivity>(
            `/users/${userId}/github-activity`,
            { params: { year } },
        );
        return data;
    },

    async getContributions(userId: string): Promise<ProblemContribution[]> {
        const { data } = await api.get<ProblemContribution[]>(
            `/users/${userId}/contributions`,
        );
        return data;
    },

    async getPracticeStatsForUser(userId: string): Promise<PracticeStats> {
        const { data } = await api.get<PracticeStats>(
            `/practice/stats/${userId}`,
        );
        return data;
    },
};
