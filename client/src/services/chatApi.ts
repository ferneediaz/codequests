import api from '@/services/api';
import type { ChatMessagePayload } from '@/types/socket';

export interface ChatHistoryResponse {
    messages: ChatMessagePayload[];
    nextCursor: string | null;
}

export interface UnreadCountsResponse {
    dmTotal: number;
    perRoom: Record<string, number>;
}

export async function getLobbyHistory(
    cursor?: string,
    limit = 50,
): Promise<ChatHistoryResponse> {
    const { data } = await api.get<ChatHistoryResponse>('/chat/LOBBY/lobby', {
        params: { cursor, limit },
    });
    return data;
}

export async function getBattleHistory(
    battleId: string,
    cursor?: string,
    limit = 50,
): Promise<ChatHistoryResponse> {
    const { data } = await api.get<ChatHistoryResponse>(`/chat/BATTLE/${battleId}`, {
        params: { cursor, limit },
    });
    return data;
}

export async function getDmHistory(
    conversationId: string,
    cursor?: string,
    limit = 50,
): Promise<ChatHistoryResponse> {
    const { data } = await api.get<ChatHistoryResponse>(
        `/chat/DM/${conversationId}`,
        { params: { cursor, limit } },
    );
    return data;
}

export async function getClanHistory(
    clanId: string,
    cursor?: string,
    limit = 50,
): Promise<ChatHistoryResponse> {
    const { data } = await api.get<ChatHistoryResponse>(`/chat/CLAN/${clanId}`, {
        params: { cursor, limit },
    });
    return data;
}

export interface DmConversationResponse {
    id: string;
    type: 'DM';
    participants: {
        id: string;
        username: string;
        avatarUrl?: string | null;
    }[];
    lastMessage?: {
        content: string;
        senderId: string;
        createdAt: string;
    };
    createdAt: string;
}

export async function getDmConversations(): Promise<DmConversationResponse[]> {
    const { data } = await api.get<DmConversationResponse[]>('/chat/conversations');
    return data;
}

export async function createDmConversation(
    targetUserId: string,
): Promise<DmConversationResponse> {
    const { data } = await api.post<DmConversationResponse>(
        '/chat/conversations',
        { targetUserId },
    );
    return data;
}

export async function getUnreadCounts(): Promise<UnreadCountsResponse> {
    const { data } = await api.get<UnreadCountsResponse>('/chat/unread-counts');
    return data;
}

export async function markChatRoomRead(
    roomType: 'BATTLE' | 'LOBBY' | 'DM' | 'CLAN',
    roomId: string,
): Promise<void> {
    await api.post(`/chat/${roomType}/${roomId}/read`);
}
