import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DmConversationView } from '@/components/messages/DmConversationView';
import { useAppSelector } from '@/store/hooks';
import { queryKeys } from '@/lib/queryKeys';
import {
    createDmConversation,
    getDmConversations,
    type DmConversationResponse,
} from '@/services/chatApi';
import type { DmTargetUser } from '@/context/socialLayoutContext';
import { UserSearchInput } from '@/components/social/UserSearchInput';
import { useUnreadDms } from '@/hooks/useUnreadDms';

export default function Messages() {
    const user = useAppSelector((state) => state.auth.user);
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const [composeOpen, setComposeOpen] = useState(false);
    const [friendQuery, setFriendQuery] = useState('');
    const unreadDms = useUnreadDms();
    const lastMissingConversationRef = useRef<string | null>(null);
    const selectedConversationId = searchParams.get('c');

    const conversationsQuery = useQuery({
        queryKey: queryKeys.chat.conversations(),
        queryFn: getDmConversations,
    });

    const conversations = conversationsQuery.data ?? [];
    const selectedConversationById =
        conversations.find((conversation) => conversation.id === selectedConversationId) ??
        null;
    const selectedConversation =
        selectedConversationById ??
        conversations[0] ??
        null;
    const selectedOtherUser = selectedConversation
        ? getOtherParticipant(selectedConversation, user?.id)
        : null;

    useEffect(() => {
        if (
            !selectedConversationId ||
            conversationsQuery.isLoading ||
            conversationsQuery.isFetching ||
            selectedConversationById ||
            lastMissingConversationRef.current === selectedConversationId
        ) {
            return;
        }

        lastMissingConversationRef.current = selectedConversationId;
        void queryClient.invalidateQueries({
            queryKey: queryKeys.chat.conversations(),
        });
    }, [
        conversationsQuery.isFetching,
        conversationsQuery.isLoading,
        queryClient,
        selectedConversationById,
        selectedConversationId,
    ]);

    const selectConversation = (conversationId: string) => {
        setSearchParams({ c: conversationId });
    };

    const startConversation = async (target: DmTargetUser) => {
        try {
            const conversation = await createDmConversation(target.id);
            await queryClient.invalidateQueries({
                queryKey: queryKeys.chat.conversations(),
            });
            setComposeOpen(false);
            setFriendQuery('');
            selectConversation(conversation.id);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Could not start conversation.';
            toast.error(message);
        }
    };

    return (
        <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-7xl flex-col px-4 py-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Messages</h1>
                    <p className="text-sm text-muted-foreground">
                        Continue direct conversations with your friends.
                    </p>
                </div>
                <Button onClick={() => setComposeOpen((open) => !open)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Message
                </Button>
            </div>

            {composeOpen && (
                <Card className="mb-4">
                    <CardContent className="space-y-3 p-4">
                        <UserSearchInput
                            value={friendQuery}
                            onChange={setFriendQuery}
                            onSelect={(target) => void startConversation(target)}
                            placeholder="Search users..."
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground">
                            Conversations can only start with users the server allows.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[320px_1fr]">
                <aside className="min-h-0 border-b border-border md:border-b-0 md:border-r">
                    <div className="border-b border-border px-4 py-3">
                        <p className="text-sm font-semibold">Inbox</p>
                    </div>
                    <div className="h-full overflow-y-auto p-2">
                        {conversationsQuery.isLoading ? (
                            <p className="p-3 text-sm text-muted-foreground">
                                Loading conversations...
                            </p>
                        ) : conversations.length === 0 ? (
                            <p className="p-3 text-sm text-muted-foreground">
                                No conversations yet.
                            </p>
                        ) : (
                            conversations.map((conversation) => {
                                const otherUser = getOtherParticipant(conversation, user?.id);
                                const selected = conversation.id === selectedConversation?.id;
                                return (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        onClick={() => selectConversation(conversation.id)}
                                        className={`mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left ${
                                            selected
                                                ? 'bg-primary/10 text-foreground'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        {otherUser.avatarUrl ? (
                                            <img
                                                src={otherUser.avatarUrl}
                                                alt={otherUser.username}
                                                className="h-9 w-9 rounded-full"
                                            />
                                        ) : (
                                            <div className="h-9 w-9 rounded-full bg-muted" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="truncate text-sm font-medium">
                                                    {otherUser.username}
                                                </p>
                                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                                    {formatTime(
                                                        conversation.lastMessage?.createdAt ??
                                                            conversation.createdAt,
                                                    )}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-2">
                                                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                                                    {conversation.lastMessage?.content ??
                                                        'No messages yet'}
                                                </p>
                                                {(unreadDms.perRoom[conversation.id] ?? 0) > 0 && (
                                                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground">
                                                        {unreadDms.perRoom[conversation.id] > 9
                                                            ? '9+'
                                                            : unreadDms.perRoom[conversation.id]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </aside>

                <section className="min-h-0">
                    {selectedConversation && selectedOtherUser ? (
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                                {selectedOtherUser.avatarUrl ? (
                                    <img
                                        src={selectedOtherUser.avatarUrl}
                                        alt={selectedOtherUser.username}
                                        className="h-8 w-8 rounded-full"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                )}
                                <div>
                                    <p className="text-sm font-semibold">
                                        {selectedOtherUser.username}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Direct message
                                    </p>
                                </div>
                            </div>
                            <DmConversationView
                                conversationId={selectedConversation.id}
                                otherUser={selectedOtherUser}
                                currentUserId={user?.id}
                            />
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center p-6 text-center">
                            <div>
                                <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                                <p className="font-medium">Select a conversation</p>
                                <p className="text-sm text-muted-foreground">
                                    Or start a new one with a friend.
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

function getOtherParticipant(
    conversation: DmConversationResponse,
    currentUserId?: string,
): DmTargetUser {
    const participant =
        conversation.participants.find((p) => p.id !== currentUserId) ??
        conversation.participants[0];
    return {
        id: participant.id,
        username: participant.username,
        avatarUrl: participant.avatarUrl,
    };
}

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}
