import api from '@/services/api';
import type { LobbySnapshot, LobbyChallengeResponse } from '@/types/lobby';

export async function getLobbySnapshot(): Promise<LobbySnapshot> {
    const { data } = await api.get<LobbySnapshot>('/lobby/snapshot');
    return data;
}

export async function sendFriendRequestByUserId(
    targetUserId: string,
): Promise<void> {
    await api.post('/lobby/friend-request', { targetUserId });
}

export async function challengeUser(
    targetUserId: string,
    timeLimitMinutes?: number,
): Promise<LobbyChallengeResponse> {
    const { data } = await api.post<LobbyChallengeResponse>(
        '/lobby/challenge',
        { targetUserId, timeLimitMinutes },
    );
    return data;
}
