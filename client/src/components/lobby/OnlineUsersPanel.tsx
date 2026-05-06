import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    User,
    UserPlus,
    MessageSquare,
    Swords,
    Check,
    Clock,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankBadge } from '@/components/ui/RankBadge';
import {
    sendFriendRequestByUserId,
    challengeUser,
} from '@/services/lobby';
import { acceptFriendRequest } from '@/services/friends';
import { createDmConversation } from '@/services/chatApi';
import { useFriends } from '@/hooks/useFriends';
import type { LobbyUser } from '@/types/lobby';

interface OnlineUsersPanelProps {
    users: LobbyUser[];
    onUserPatch: (userId: string, patch: Partial<LobbyUser>) => void;
    onRefresh: () => void;
    onOpenDm: (conversationId: string, otherUser: LobbyUser) => void;
}

export function OnlineUsersPanel({
    users,
    onUserPatch,
    onRefresh,
    onOpenDm,
}: OnlineUsersPanelProps) {
    const navigate = useNavigate();
    const { seedOutgoingRequest } = useFriends();
    const [query, setQuery] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                u.username.toLowerCase().includes(q) ||
                u.clan?.tag.toLowerCase().includes(q) ||
                u.clan?.name.toLowerCase().includes(q),
        );
    }, [users, query]);

    const handleAddFriend = async (user: LobbyUser) => {
        setBusyId(user.id);
        try {
            const request = await sendFriendRequestByUserId(user.id);
            onUserPatch(user.id, {
                friendship: 'PENDING_OUT',
                friendshipId: request.id,
            });
            seedOutgoingRequest({
                ...user,
                friendship: 'PENDING_OUT',
                friendshipId: request.id,
            });
            toast.success(`Friend request sent to ${user.username}.`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to send friend request.';
            toast.error(message);
        } finally {
            setBusyId(null);
        }
    };

    const handleAcceptRequest = async (user: LobbyUser) => {
        if (!user.friendshipId) return;
        setBusyId(user.id);
        try {
            await acceptFriendRequest(user.friendshipId);
            onUserPatch(user.id, { friendship: 'ACCEPTED' });
            toast.success(`You and ${user.username} are now friends.`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to accept request.';
            toast.error(message);
        } finally {
            setBusyId(null);
        }
    };

    const handleMessage = async (user: LobbyUser) => {
        if (user.friendship !== 'ACCEPTED') {
            toast.info(
                'You can only DM friends. Send a friend request first.',
            );
            return;
        }
        setBusyId(user.id);
        try {
            const conv = await createDmConversation(user.id);
            onOpenDm(conv.id, user);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to open conversation.';
            toast.error(message);
        } finally {
            setBusyId(null);
        }
    };

    const handleChallenge = async (user: LobbyUser) => {
        setBusyId(user.id);
        try {
            const resp = await challengeUser(user.id);
            toast.success(
                resp.delivered
                    ? `Challenge sent to ${user.username}!`
                    : `Challenge created. ${user.username} is offline so they'll see it on reconnect.`,
            );
            navigate(`/battle/${resp.battleId}`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to send challenge.';
            toast.error(message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide">
                            Online Players
                        </h3>
                        <Badge variant="secondary">{users.length}</Badge>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onRefresh}
                        className="text-xs text-muted-foreground"
                    >
                        Refresh
                    </Button>
                </div>

                <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        placeholder="Search by name or clan tag"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {filtered.length === 0 ? (
                        <div className="flex h-full items-center justify-center py-6 text-center text-xs text-muted-foreground">
                            {users.length === 0
                                ? 'No one else online right now. Invite a friend!'
                                : 'No matches.'}
                        </div>
                    ) : (
                        filtered.map((u) => (
                            <UserRow
                                key={u.id}
                                user={u}
                                busy={busyId === u.id}
                                onAddFriend={() => void handleAddFriend(u)}
                                onAcceptRequest={() => void handleAcceptRequest(u)}
                                onMessage={() => void handleMessage(u)}
                                onChallenge={() => void handleChallenge(u)}
                            />
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

interface UserRowProps {
    user: LobbyUser;
    busy: boolean;
    onAddFriend: () => void;
    onAcceptRequest: () => void;
    onMessage: () => void;
    onChallenge: () => void;
}

function UserRow({
    user,
    busy,
    onAddFriend,
    onAcceptRequest,
    onMessage,
    onChallenge,
}: UserRowProps) {
    return (
        <div className="flex items-center justify-between rounded-md border border-border bg-background/60 px-2 py-1.5 hover:border-primary/40">
            <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                    {user.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt={user.username}
                            className="h-7 w-7 rounded-full"
                        />
                    ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                            <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-card bg-emerald-500" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                            {user.username}
                        </span>
                        {user.clan && (
                            <span className="text-[10px] font-semibold text-muted-foreground">
                                [{user.clan.tag}]
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5">
                        <RankBadge mmr={user.mmr} className="text-[10px]" />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <FriendButton
                    user={user}
                    busy={busy}
                    onAddFriend={onAddFriend}
                    onAcceptRequest={onAcceptRequest}
                />
                <IconAction
                    title="Message"
                    disabled={busy || user.friendship !== 'ACCEPTED'}
                    onClick={onMessage}
                    hint={
                        user.friendship !== 'ACCEPTED'
                            ? 'Add as friend to DM'
                            : 'Send a message'
                    }
                >
                    <MessageSquare className="h-3.5 w-3.5" />
                </IconAction>
                <IconAction
                    title="Challenge"
                    disabled={busy}
                    onClick={onChallenge}
                    hint="Challenge to 1v1"
                    accent
                >
                    <Swords className="h-3.5 w-3.5" />
                </IconAction>
            </div>
        </div>
    );
}

function FriendButton({
    user,
    busy,
    onAddFriend,
    onAcceptRequest,
}: {
    user: LobbyUser;
    busy: boolean;
    onAddFriend: () => void;
    onAcceptRequest: () => void;
}) {
    if (user.friendship === 'ACCEPTED') {
        return (
            <div
                className="flex h-7 w-7 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                title="Friends"
            >
                <Check className="h-3.5 w-3.5" />
            </div>
        );
    }
    if (user.friendship === 'PENDING_OUT') {
        return (
            <div
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground"
                title="Request pending"
            >
                <Clock className="h-3.5 w-3.5" />
            </div>
        );
    }
    if (user.friendship === 'PENDING_IN') {
        return (
            <button
                type="button"
                onClick={onAcceptRequest}
                disabled={busy}
                className="flex h-7 items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                title="Accept friend request"
            >
                <Check className="h-3 w-3" />
                Accept
            </button>
        );
    }
    return (
        <IconAction
            title="Add friend"
            disabled={busy}
            onClick={onAddFriend}
            hint="Add as friend"
        >
            <UserPlus className="h-3.5 w-3.5" />
        </IconAction>
    );
}

function IconAction({
    children,
    onClick,
    disabled,
    hint,
    accent,
}: {
    children: React.ReactNode;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    hint?: string;
    accent?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={hint}
            className={`flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                accent
                    ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                    : 'border-border bg-background hover:border-primary/40 hover:text-foreground'
            }`}
        >
            {children}
        </button>
    );
}
