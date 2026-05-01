import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Flame } from 'lucide-react';
import { useBattleChat } from '@/hooks/useBattleChat';
import { Button } from '@/components/ui/button';

const TRASH_TALK_PRESETS = [
    'Skill issue. 😤',
    'Too easy 🥱',
    'git gud',
    "You're cooked 🔥",
    'Touch grass after this',
    'NaN brain detected',
    'Did you even read the problem?',
    "I'm barely trying",
    'Stack overflow… of Ls',
    'Runtime? More like ruined-time',
];

const EMOJI_REACTIONS = ['😂', '🔥', '💀', '🤡', '🫵', '🐢', '🥶', '😮‍💨'];

interface BattleChatProps {
    battleId: string;
    currentUserId: string;
}

export function BattleChat({ battleId, currentUserId }: BattleChatProps) {
    const { messages, sendMessage } = useBattleChat(battleId);
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    // While chat is open, every incoming message is implicitly "read", so we
    // track the message count at the moment the chat was last closed and
    // derive `unread` from that. State only changes via the toggle handler,
    // never inside an effect.
    const [lastSeenLen, setLastSeenLen] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (open && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages, open]);

    const unread = open ? 0 : Math.max(0, messages.length - lastSeenLen);

    const handleToggleOpen = () => {
        setOpen((prev) => {
            if (prev) {
                // Closing → anchor unread baseline at the current count so
                // future messages start counting from 0.
                setLastSeenLen(messages.length);
            } else {
                // Opening → reset baseline so unread shows 0 immediately.
                setLastSeenLen(messages.length);
            }
            return !prev;
        });
    };

    const handleSend = () => {
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
    };

    const handleQuickSend = (text: string) => {
        sendMessage(text);
    };

    return (
        <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex flex-col items-end">
            {open && (
                <div className="mb-2 flex h-[420px] w-[340px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                    <div className="flex items-center justify-between border-b border-border bg-card/90 px-3 py-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Flame className="h-4 w-4 text-orange-400" />
                            <span>Trash Talk</span>
                        </div>
                        <button
                            onClick={handleToggleOpen}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={listRef}
                        className="flex-1 overflow-y-auto px-3 py-2 text-sm"
                    >
                        {messages.length === 0 && (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No trash talk yet. Break the ice 👇
                            </div>
                        )}
                        {messages.map((m) => {
                            if ('system' in m && m.system) {
                                return (
                                    <div
                                        key={m.id}
                                        className="my-1 text-center text-[11px] italic text-muted-foreground"
                                    >
                                        {m.content}
                                    </div>
                                );
                            }
                            const msg = m as Exclude<typeof m, { system: true }>;
                            const isSelf = msg.senderId === currentUserId;
                            return (
                                <div
                                    key={msg.id}
                                    className={`mb-2 flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                                >
                                    <span className="mb-0.5 text-[10px] text-muted-foreground">
                                        {msg.senderUsername}
                                    </span>
                                    <div
                                        className={`max-w-[85%] rounded-lg px-3 py-1.5 ${
                                            isSelf
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-foreground'
                                        }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick taunts */}
                    <div className="border-t border-border bg-card/80 px-2 py-1.5">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Quick taunts
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {TRASH_TALK_PRESETS.map((taunt) => (
                                <button
                                    key={taunt}
                                    onClick={() => handleQuickSend(taunt)}
                                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] hover:border-orange-400/60 hover:bg-orange-500/10 hover:text-orange-300"
                                >
                                    {taunt}
                                </button>
                            ))}
                        </div>
                        <div className="mt-1 flex gap-1">
                            {EMOJI_REACTIONS.map((e) => (
                                <button
                                    key={e}
                                    onClick={() => handleQuickSend(e)}
                                    className="rounded px-1 text-base hover:bg-muted"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Input */}
                    <div className="flex items-center gap-1 border-t border-border p-2">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type or click a taunt…"
                            maxLength={500}
                            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                        />
                        <Button size="sm" onClick={handleSend} disabled={!input.trim()}>
                            <Send className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <button
                onClick={handleToggleOpen}
                className="relative flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg hover:brightness-110"
            >
                <MessageCircle className="h-4 w-4" />
                <span>Chat</span>
                {!open && unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>
        </div>
    );
}
