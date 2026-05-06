import api from './api';
import type { MatchHistoryEntry, NewsFilter, NewsResponse, UserStats } from '@/types/api';

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
};
