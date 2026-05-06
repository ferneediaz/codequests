import api from './api';
import type { MatchHistoryEntry, NewsFilter, NewsResponse, UserStats } from '@/types/api';

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
