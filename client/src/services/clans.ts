import api from '@/services/api';
import type {
    Clan,
    ClanChallenge,
    CounterClanChallengePayload,
    CreateClanPayload,
    ListClansParams,
    SendClanChallengePayload,
    UpdateClanPayload,
} from '@/types/clans';

export async function listClans(params: ListClansParams = {}): Promise<Clan[]> {
    const { limit = 100, offset = 0 } = params;
    const { data } = await api.get<Clan[]>('/clans', { params: { limit, offset } });
    return data;
}

export async function getClan(clanId: string): Promise<Clan> {
    const { data } = await api.get<Clan>(`/clans/${clanId}`);
    return data;
}

export async function createClan(payload: CreateClanPayload): Promise<Clan> {
    const { data } = await api.post<Clan>('/clans', payload);
    return data;
}

export async function updateClan(
    clanId: string,
    payload: UpdateClanPayload,
): Promise<Clan> {
    const { data } = await api.patch<Clan>(`/clans/${clanId}`, payload);
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

export async function kickMember(
    clanId: string,
    memberId: string,
): Promise<Clan> {
    const { data } = await api.delete<Clan>(`/clans/${clanId}/members/${memberId}`);
    return data;
}

export async function getClanChallenges(
    clanId: string,
    params: { pending?: boolean } = {},
): Promise<ClanChallenge[]> {
    const { data } = await api.get<ClanChallenge[]>(`/clans/${clanId}/challenges`, {
        params,
    });
    return data;
}

export async function sendClanChallenge(
    payload: SendClanChallengePayload,
): Promise<ClanChallenge> {
    const { data } = await api.post<ClanChallenge>('/clans/challenges', payload);
    return data;
}

export async function acceptClanChallenge(
    challengeId: string,
): Promise<ClanChallenge> {
    const { data } = await api.post<ClanChallenge>(
        `/clans/challenges/${challengeId}/accept`,
    );
    return data;
}

export async function declineClanChallenge(
    challengeId: string,
): Promise<ClanChallenge> {
    const { data } = await api.post<ClanChallenge>(
        `/clans/challenges/${challengeId}/decline`,
    );
    return data;
}

export async function counterClanChallenge(
    challengeId: string,
    payload: CounterClanChallengePayload,
): Promise<ClanChallenge> {
    const { data } = await api.post<ClanChallenge>(
        `/clans/challenges/${challengeId}/counter`,
        payload,
    );
    return data;
}
