import api from '@/services/api';
import type { ChatMessagePayload } from '@/types/socket';

export interface ChatHistoryResponse {
    messages: ChatMessagePayload[];
    nextCursor: string | null;
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

export interface DmConversationResponse {
    id: string;
    type: 'DM';
    participants: {
        id: string;
        username: string;
        avatarUrl?: string | null;
    }[];
    createdAt: string;
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
