import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getClanHistory, markChatRoomRead } from '@/services/chatApi';
import { getChatSocket } from '@/services/socket';
import type { ChatMessagePayload } from '@/types/socket';

export function ClanChatPanel({
    clanId,
    currentUserId,
}: {
    clanId: string;
    currentUserId?: string;
}) {
    const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
    const [input, setInput] = useState('');
    const joinedRef = useRef(false);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;
        void getClanHistory(clanId)
            .then(async ({ messages: history }) => {
                if (cancelled) return;
                setMessages(history);
                await markChatRoomRead('CLAN', clanId);
            })
            .catch(() => {
                if (!cancelled) setMessages([]);
            });
        return () => {
            cancelled = true;
        };
    }, [clanId]);

    useEffect(() => {
        const socket = getChatSocket();
        if (!socket) return;

        const join = () => {
            if (joinedRef.current) return;
            socket.emit(
                'chat.join_room',
                { roomType: 'CLAN', roomId: clanId },
                (resp: { success?: boolean }) => {
                    if (resp?.success) joinedRef.current = true;
                },
            );
        };

        if (socket.connected) join();
        else socket.once('connect', join);

        const handleMessage = (message: ChatMessagePayload) => {
            if (message.roomType !== 'CLAN' || message.roomId !== clanId) return;
            setMessages((prev) => {
                if (prev.some((item) => item.id === message.id)) return prev;
                return [...prev, message];
            });
            void markChatRoomRead('CLAN', clanId);
        };

        socket.on('chat.message', handleMessage);
        return () => {
            socket.off('chat.message', handleMessage);
            socket.off('connect', join);
            if (joinedRef.current) {
                socket.emit('chat.leave_room', { roomType: 'CLAN', roomId: clanId });
                joinedRef.current = false;
            }
        };
    }, [clanId]);

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
            roomType: 'CLAN',
            roomId: clanId,
            content: text.slice(0, 500),
        });
        setInput('');
    }, [clanId, input]);

    return (
        <div className="flex h-[360px] flex-col rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
                <h2 className="text-lg font-semibold">Clan Chat</h2>
                <p className="text-xs text-muted-foreground">Only clan members can read and post.</p>
            </div>
            <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                {messages.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                        Start the clan conversation.
                    </p>
                ) : (
                    messages.map((message) => {
                        const isSelf = message.senderId === currentUserId;
                        return (
                            <div
                                key={message.id}
                                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                            >
                                {!isSelf && (
                                    <span className="mb-1 text-[10px] text-muted-foreground">
                                        {message.senderUsername}
                                    </span>
                                )}
                                <div
                                    className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
                                        isSelf
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-foreground'
                                    }`}
                                >
                                    {message.content}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            <div className="flex items-center gap-2 border-t border-border p-3">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                    placeholder="Message your clan..."
                    maxLength={500}
                    className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <Button size="sm" onClick={send} disabled={!input.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
