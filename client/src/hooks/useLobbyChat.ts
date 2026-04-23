import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatSocket } from '@/services/socket';
import { getLobbyHistory } from '@/services/chatApi';
import type { ChatMessagePayload } from '@/types/socket';

/**
 * Public lobby chat hook. Auto-joins the `LOBBY/lobby` room on connect
 * (the chat gateway also auto-joins on connect, but we re-emit to be
 * resilient to namespace reconnects).
 *
 * On mount we also pull recent history via REST so the channel doesn't
 * appear empty for new visitors.
 */
export function useLobbyChat() {
    const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const joinedRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { messages: history } = await getLobbyHistory();
                if (!cancelled) setMessages(history);
            } catch {
                // History is best-effort; failure just means an empty view.
            } finally {
                if (!cancelled) setLoadingHistory(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const socket = getChatSocket();
        if (!socket) return;

        const join = () => {
            if (joinedRef.current) return;
            socket.emit(
                'chat.join_room',
                { roomType: 'LOBBY', roomId: 'lobby' },
                (resp: { success?: boolean }) => {
                    if (resp?.success) joinedRef.current = true;
                },
            );
        };

        if (socket.connected) join();
        else socket.once('connect', join);

        const handleMessage = (msg: ChatMessagePayload) => {
            if (msg.roomType !== 'LOBBY') return;
            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        };

        socket.on('chat.message', handleMessage);

        return () => {
            socket.off('chat.message', handleMessage);
            socket.off('connect', join);
            // We intentionally do NOT leave the lobby room on unmount: the
            // chat gateway auto-joins it on connect and other surfaces may
            // want lobby messages later. Leaving/rejoining produces noisy
            // system events.
        };
    }, []);

    const sendMessage = useCallback((content: string) => {
        const text = content.trim();
        if (!text) return;
        const socket = getChatSocket();
        if (!socket) return;
        socket.emit('chat.send', {
            roomType: 'LOBBY',
            roomId: 'lobby',
            content: text.slice(0, 500),
        });
    }, []);

    return { messages, loadingHistory, sendMessage };
}
