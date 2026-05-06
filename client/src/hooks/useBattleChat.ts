import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatSocket } from '@/services/socket';
import { getBattleHistory, markChatRoomRead } from '@/services/chatApi';
import type { ChatMessagePayload } from '@/types/socket';

interface SystemMessage {
    id: string;
    system: true;
    content: string;
    createdAt: string;
}

export type ChatItem = ChatMessagePayload | SystemMessage;

export function useBattleChat(battleId: string | undefined) {
    const [chatState, setChatState] = useState<{
        battleId: string | undefined;
        messages: ChatItem[];
    }>({ battleId: undefined, messages: [] });
    const joinedRef = useRef(false);
    const messages = chatState.battleId === battleId ? chatState.messages : [];

    useEffect(() => {
        if (!battleId) return;

        let cancelled = false;
        (async () => {
            try {
                const { messages: history } = await getBattleHistory(battleId);
                if (cancelled) return;
                setChatState((prev) => ({
                    battleId,
                    messages: mergeChatMessages(
                        history,
                        prev.battleId === battleId ? prev.messages : [],
                    ),
                }));
                await markChatRoomRead('BATTLE', battleId);
            } catch {
                // History is best-effort; realtime chat still works without it.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [battleId]);

    useEffect(() => {
        if (!battleId) return;
        const socket = getChatSocket();
        if (!socket) return;

        const join = () => {
            if (joinedRef.current) return;
            socket.emit(
                'chat.join_room',
                { roomType: 'BATTLE', roomId: battleId },
                (resp: { success: boolean; error?: string }) => {
                    if (resp?.success) joinedRef.current = true;
                    else console.warn('[chat] join failed:', resp?.error);
                },
            );
        };

        if (socket.connected) join();
        else socket.once('connect', join);

        const handleMessage = (msg: ChatMessagePayload) => {
            if (msg.roomType !== 'BATTLE' || msg.roomId !== battleId) return;
            setChatState((prev) => ({
                battleId,
                messages: mergeChatMessages(
                    prev.battleId === battleId ? prev.messages : [],
                    [msg],
                ),
            }));
            void markChatRoomRead('BATTLE', battleId);
        };

        const handleUserJoined = (data: { username: string; roomType: string; roomId: string }) => {
            if (data.roomType !== 'BATTLE' || data.roomId !== battleId) return;
            setChatState((prev) => ({
                battleId,
                messages: [
                    ...(prev.battleId === battleId ? prev.messages : []),
                    {
                        id: `sys-${Date.now()}-${Math.random()}`,
                        system: true,
                        content: `${data.username} joined the chat`,
                        createdAt: new Date().toISOString(),
                    },
                ],
            }));
        };

        socket.on('chat.message', handleMessage);
        socket.on('chat.user_joined', handleUserJoined);

        return () => {
            socket.off('chat.message', handleMessage);
            socket.off('chat.user_joined', handleUserJoined);
            socket.off('connect', join);
            if (joinedRef.current) {
                socket.emit('chat.leave_room', { roomType: 'BATTLE', roomId: battleId });
                joinedRef.current = false;
            }
        };
    }, [battleId]);

    const sendMessage = useCallback(
        (content: string) => {
            const text = content.trim();
            if (!text || !battleId) return;
            const socket = getChatSocket();
            if (!socket) return;
            socket.emit('chat.send', {
                roomType: 'BATTLE',
                roomId: battleId,
                content: text.slice(0, 500),
            });
        },
        [battleId],
    );

    return { messages, sendMessage };
}

function mergeChatMessages(
    existing: ChatItem[],
    incoming: ChatItem[],
): ChatItem[] {
    const seen = new Set(existing.map((message) => message.id));
    const next = [...existing];
    for (const message of incoming) {
        if (seen.has(message.id)) continue;
        seen.add(message.id);
        next.push(message);
    }
    return next;
}
