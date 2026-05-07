import api from './api';
import type { Achievement } from '@/types/achievement';

export const achievementsApi = {
    async listMine(): Promise<Achievement[]> {
        const { data } = await api.get<Achievement[]>('/achievements/me');
        return data;
    },

    async listForUser(userId: string): Promise<Achievement[]> {
        const { data } = await api.get<Achievement[]>(
            `/achievements/${userId}`,
        );
        return data;
    },
};
