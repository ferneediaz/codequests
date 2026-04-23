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
