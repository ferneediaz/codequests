import { useEffect, useRef, useState } from 'react';
import { Send, MessagesSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLobbyChat } from '@/hooks/useLobbyChat';

interface LobbyChatPanelProps {
    currentUserId?: string;
}

/**
 * Public lobby chat — a single shared channel anyone online can post in.
 * Shows a scrollable history with auto-scroll-on-new and a simple composer.
 */
export function LobbyChatPanel({ currentUserId }: LobbyChatPanelProps) {
    const { messages, loadingHistory, sendMessage } = useLobbyChat();
    const [input, setInput] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages.length]);

    const handleSend = () => {
        const text = input.trim();
        if (!text) return;
        sendMessage(text);
        setInput('');
    };

    return (
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                    <MessagesSquare className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                        Public Chat
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                        · All online players
                    </span>
                </div>

                <div
                    ref={listRef}
                    className="flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-background/40 p-3 text-sm"
                >
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Loading chat history...
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">
                            No messages yet. Say hello!
                        </div>
                    ) : (
                        messages.map((m) => {
                            const isSelf = m.senderId === currentUserId;
                            return (
                                <div
                                    key={m.id}
                                    className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                                >
                                    <div className="mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                        <span className={isSelf ? 'font-semibold text-primary' : ''}>
                                            {isSelf ? 'You' : m.senderUsername}
                                        </span>
                                        <span>·</span>
                                        <span>
                                            {formatTime(m.createdAt)}
                                        </span>
                                    </div>
                                    <div
                                        className={`max-w-[80%] break-words rounded-lg px-3 py-1.5 text-sm ${
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

                <div className="flex items-center gap-2">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Message #lobby..."
                        maxLength={500}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button onClick={handleSend} disabled={!input.trim()}>
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Send
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}
