import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RankBadge } from '@/components/ui/RankBadge';
import type { PendingRequest } from '@/services/friends';
import { useFriends } from '@/hooks/useFriends';
import { FriendAvatar } from './FriendAvatar';

interface IncomingRequestRowProps {
    request: PendingRequest;
}

export function IncomingRequestRow({ request }: IncomingRequestRowProps) {
    const { accept, decline } = useFriends();
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

    const handleAccept = async () => {
        setBusy('accept');
        try {
            await accept(request.id);
        } finally {
            setBusy(null);
        }
    };

    const handleDecline = async () => {
        setBusy('decline');
        try {
            await decline(request.id);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-2 py-2">
            <FriendAvatar
                username={request.requester.username}
                avatarUrl={request.requester.avatarUrl}
                online={false}
            />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                    {request.requester.username}
                </div>
                <RankBadge mmr={request.requester.mmr} className="mt-0.5 text-[10px]" />
            </div>
            <div className="flex items-center gap-1">
                <Button
                    size="icon"
                    className="h-7 w-7"
                    disabled={busy !== null}
                    onClick={() => void handleAccept()}
                    title="Accept"
                >
                    {busy === 'accept' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Check className="h-3.5 w-3.5" />
                    )}
                </Button>
                <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    disabled={busy !== null}
                    onClick={() => void handleDecline()}
                    title="Decline"
                >
                    {busy === 'decline' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <X className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>
        </div>
    );
}
