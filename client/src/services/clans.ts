import api from '@/services/api';
import type { Clan, CreateClanPayload } from '@/types/clans';

export async function listClans(limit = 100): Promise<Clan[]> {
    const { data } = await api.get<Clan[]>('/clans', { params: { limit, offset: 0 } });
    return data;
}

export async function createClan(payload: CreateClanPayload): Promise<Clan> {
    const { data } = await api.post<Clan>('/clans', payload);
    return data;
}

export async function findClanByTag(tag: string): Promise<Clan> {
    const { data } = await api.get<Clan>(`/clans/tag/${tag}`);
    return data;
}

export async function joinClan(clanId: string): Promise<Clan> {
    const { data } = await api.post<Clan>(`/clans/${clanId}/join`);
    return data;
}

export async function leaveClan(): Promise<void> {
    await api.post('/clans/leave');
}
