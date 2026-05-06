import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDmHistory, markChatRoomRead } from '@/services/chatApi';
import { getChatSocket } from '@/services/socket';
import type { DmTargetUser } from '@/context/socialLayoutContext';
import type { ChatMessagePayload } from '@/types/socket';
import { queryKeys } from '@/lib/queryKeys';

interface DmConversationViewProps {
    conversationId: string;
    otherUser: DmTargetUser;
    currentUserId?: string;
    className?: string;
}

export function DmConversationView({
    conversationId,
    otherUser,
    currentUserId,
    className = '',
}: DmConversationViewProps) {
    const [chatState, setChatState] = useState<{
        conversationId: string;
        messages: ChatMessagePayload[];
    }>({ conversationId: '', messages: [] });
    const [input, setInput] = useState('');
    const queryClient = useQueryClient();
    const joinedRef = useRef(false);
    const listRef = useRef<HTMLDivElement>(null);
    const loading = chatState.conversationId !== conversationId;
    const messages =
        chatState.conversationId === conversationId ? chatState.messages : [];

    const markRead = useCallback(async () => {
        await markChatRoomRead('DM', conversationId);
        await queryClient.invalidateQueries({
            queryKey: queryKeys.chat.unreadCounts(),
        });
    }, [conversationId, queryClient]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { messages: history } = await getDmHistory(conversationId);
                if (!cancelled) {
                    setChatState({ conversationId, messages: history });
                    await markRead();
                }
            } catch {
                if (!cancelled) {
                    setChatState({ conversationId, messages: [] });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [conversationId, markRead]);

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
            setChatState((prev) => {
                const messages = prev.conversationId === conversationId ? prev.messages : [];
                if (messages.some((m) => m.id === msg.id)) return prev;
                return {
                    conversationId,
                    messages: [...messages, msg],
                };
            });
            void markRead();
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
    }, [conversationId, markRead]);

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
        <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-2 text-sm">
                {loading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                        Loading...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                        Start the conversation with {otherUser.username}.
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
