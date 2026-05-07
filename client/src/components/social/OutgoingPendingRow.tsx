import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { RankBadge } from '@/components/ui/RankBadge';
import type { OutgoingFriendRequest } from '@/context/friendNotificationsContext';
import { FriendAvatar } from './FriendAvatar';

interface OutgoingPendingRowProps {
    request: OutgoingFriendRequest;
}

export function OutgoingPendingRow({ request }: OutgoingPendingRowProps) {
    return (
        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-2 py-2">
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
        </div>
    );
}
