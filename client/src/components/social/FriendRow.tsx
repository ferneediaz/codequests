import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    MoreHorizontal,
    MessageSquare,
    Swords,
    Trash2,
    Loader2,
    User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RankBadge } from '@/components/ui/RankBadge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createDmConversation } from '@/services/chatApi';
import { challengeUser } from '@/services/lobby';
import type { FriendRecord } from '@/services/friends';
import { useFriends } from '@/hooks/useFriends';
import { useSocialLayout } from '@/hooks/useSocialLayout';
import { FriendAvatar } from './FriendAvatar';

interface FriendRowProps {
    friend: FriendRecord;
    online: boolean;
}

export function FriendRow({ friend, online }: FriendRowProps) {
    const navigate = useNavigate();
    const { remove } = useFriends();
    const { openDm } = useSocialLayout();
    const [busy, setBusy] = useState<'dm' | 'challenge' | 'remove' | null>(null);

    const handleMessage = async () => {
        setBusy('dm');
        try {
            const conversation = await createDmConversation(friend.id);
            openDm(conversation.id, friend);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to open conversation.';
            toast.error(message);
        } finally {
            setBusy(null);
        }
    };

    const handleChallenge = async () => {
        setBusy('challenge');
        try {
            const response = await challengeUser(friend.id);
            toast.success(
                response.delivered
                    ? `Challenge sent to ${friend.username}!`
                    : `Challenge created. ${friend.username} will see it on reconnect.`,
            );
            navigate(`/battle/${response.battleId}`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? 'Failed to send challenge.';
            toast.error(message);
        } finally {
            setBusy(null);
        }
    };

    const handleRemove = async () => {
        const confirmed = window.confirm(`Remove ${friend.username} as a friend?`);
        if (!confirmed) return;
        setBusy('remove');
        try {
            await remove(friend.id);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-2 hover:border-border hover:bg-muted/40">
            <Link
                to={`/profile/${friend.username}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`View @${friend.username}'s profile`}
            >
                <FriendAvatar
                    username={friend.username}
                    avatarUrl={friend.avatarUrl}
                    online={online}
                />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium hover:underline">
                        {friend.username}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                        <RankBadge mmr={friend.mmr} className="text-[10px]" />
                        <span className="text-[10px] text-muted-foreground">
                            {online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
            </Link>
            {busy ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-70 group-hover:opacity-100"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem
                            onClick={() => navigate(`/profile/${friend.username}`)}
                        >
                            <UserIcon className="h-4 w-4" />
                            View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleMessage()}>
                            <MessageSquare className="h-4 w-4" />
                            Message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleChallenge()}>
                            <Swords className="h-4 w-4" />
                            Challenge
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void handleRemove()}
                        >
                            <Trash2 className="h-4 w-4" />
                            Remove friend
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
