import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RankBadge } from '@/components/ui/RankBadge';
import type { OutgoingFriendRequest } from '@/context/friendNotificationsContext';
import { useFriends } from '@/hooks/useFriends';
import { FriendAvatar } from './FriendAvatar';

interface OutgoingPendingRowProps {
    request: OutgoingFriendRequest;
}

export function OutgoingPendingRow({ request }: OutgoingPendingRowProps) {
    const { cancelOutgoingRequest } = useFriends();
    const [busy, setBusy] = useState(false);

    const handleCancel = async () => {
        setBusy(true);
        try {
            await cancelOutgoingRequest(request.friendshipId);
        } catch {
            setBusy(false);
        }
    };

    return (
        <div className="group flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-2 py-2">
            <Link
                to={`/profile/${request.username}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={`View @${request.username}'s profile`}
            >
                <FriendAvatar
                    username={request.username}
                    avatarUrl={request.avatarUrl}
                    online={false}
                />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium hover:underline">
                        {request.username}
                    </div>
                    <RankBadge mmr={request.mmr} className="mt-0.5 text-[10px]" />
                </div>
            </Link>
            <div
                className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                title="Waiting for response"
            >
                <Clock className="h-3 w-3" />
                Pending
            </div>
            <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-70 group-hover:opacity-100"
                onClick={() => void handleCancel()}
                disabled={busy}
                title="Cancel friend request"
                aria-label={`Cancel friend request to ${request.username}`}
            >
                {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <X className="h-3.5 w-3.5" />
                )}
            </Button>
        </div>
    );
}
