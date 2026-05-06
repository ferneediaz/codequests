import api from '@/services/api';

export interface FriendRecord {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    friendshipId: string;
}

export interface PendingRequest {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    createdAt: string;
    requester: {
        id: string;
        username: string;
        avatarUrl?: string | null;
        mmr: number;
    };
}

export interface SentFriendRequest {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    createdAt: string;
    addressee: {
        id: string;
        username: string;
        avatarUrl?: string | null;
        mmr: number;
    };
}

export async function listFriends(): Promise<FriendRecord[]> {
    const { data } = await api.get<FriendRecord[]>('/friends');
    return data;
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
    const { data } = await api.get<PendingRequest[]>('/friends/requests');
    return data;
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
    await api.post(`/friends/${friendshipId}/accept`);
}

export async function declineFriendRequest(friendshipId: string): Promise<void> {
    await api.post(`/friends/${friendshipId}/decline`);
}

export async function sendFriendRequestByUsername(
    username: string,
): Promise<SentFriendRequest> {
    const { data } = await api.post<SentFriendRequest>('/friends/request', {
        username,
    });
    return data;
}

export async function removeFriend(
    friendUserId: string,
): Promise<{ success: true }> {
    const { data } = await api.delete<{ success: true }>(
        `/friends/${friendUserId}`,
    );
    return data;
}
