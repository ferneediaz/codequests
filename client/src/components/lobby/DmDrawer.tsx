import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { getChatSocket } from '@/services/socket';
import type { ChatMessagePayload } from '@/types/socket';
import type { DmTargetUser } from '@/context/socialLayoutContext';

interface DmDrawerProps {
    conversationId: string;
    otherUser: DmTargetUser;
    currentUserId?: string;
    onClose: () => void;
}

/**
 * Lightweight DM panel that opens when the user clicks "Message" on a lobby
 * row. Joins the DM Socket.IO room, fetches recent history, and streams
 * incoming messages. Intentionally simple: no unread tracking or multi-DM
 * tabbing — that can come in Phase 3.
 */
export function DmDrawer({
    conversationId,
    otherUser,
    currentUserId,
    onClose,
}: DmDrawerProps) {
    const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const joinedRef = useRef(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get<{ messages: ChatMessagePayload[] }>(
                    `/chat/DM/${conversationId}`,
                    { params: { limit: 50 } },
                );
                if (!cancelled) setMessages(data.messages);
            } catch {
                // best-effort
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [conversationId]);

    useEffect(() => {
        const socket = getChatSocket();
        if (!socket) return;

        const join = () => {
            if (joinedRef.current) return;
            socket.emit(
                'chat.join_room',
                { roomType: 'DM', roomId: conversationId },
                (resp: { success?: boolean }) => {
                    if (resp?.success) joinedRef.current = true;
                },
            );
        };

        if (socket.connected) join();
        else socket.once('connect', join);

        const handleMessage = (msg: ChatMessagePayload) => {
            if (msg.roomType !== 'DM' || msg.roomId !== conversationId) return;
            setMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
        };

        socket.on('chat.message', handleMessage);
        return () => {
            socket.off('chat.message', handleMessage);
            socket.off('connect', join);
            if (joinedRef.current) {
                socket.emit('chat.leave_room', {
                    roomType: 'DM',
                    roomId: conversationId,
                });
                joinedRef.current = false;
            }
        };
    }, [conversationId]);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages.length]);

    const send = useCallback(() => {
        const text = input.trim();
        if (!text) return;
        const socket = getChatSocket();
        if (!socket) return;
        socket.emit('chat.send', {
            roomType: 'DM',
            roomId: conversationId,
            content: text.slice(0, 500),
        });
        setInput('');
    }, [conversationId, input]);

    return (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex h-[440px] w-[340px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                    {otherUser.avatarUrl ? (
                        <img
                            src={otherUser.avatarUrl}
                            alt={otherUser.username}
                            className="h-6 w-6 rounded-full"
                        />
                    ) : (
                        <div className="h-6 w-6 rounded-full bg-muted" />
                    )}
                    <span className="truncate text-sm font-semibold">
                        {otherUser.username}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
                {loading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                        Loading...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                        Start the conversation.
                    </div>
                ) : (
                    messages.map((m) => {
                        const isSelf = m.senderId === currentUserId;
                        return (
                            <div
                                key={m.id}
                                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
                                        isSelf
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground'
                                    }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex items-center gap-1 border-t border-border p-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                />
                <Button size="sm" onClick={send} disabled={!input.trim()}>
                    <Send className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}
