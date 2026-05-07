import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, LogIn, UserMinus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/store/hooks';
import { useFriends } from '@/hooks/useFriends';

interface FriendActionButtonProps {
    /** Target user's user ID — required to call `removeFriend`. */
    targetUserId: string;
    /** Target user's username — required to send a friend request. */
    targetUsername: string;
}

/**
 * Profile-page action button that picks one of:
 * - "Log in to add" (anonymous viewer)
 * - "Add Friend" (no relation yet)
 * - "Pending" disabled chip (outgoing request — server has no cancel route)
 * - "Accept" / "Decline" pair (incoming request)
 * - "Remove Friend" (already friends)
 *
 * The page-level redirect on `/profile/:username` guarantees the viewer
 * is never the target user, so a `self` state is intentionally absent.
 */
export function FriendActionButton({
    targetUserId,
    targetUsername,
}: FriendActionButtonProps) {
    const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
    const friendsCtx = useFriends();
    const [busy, setBusy] = useState<'add' | 'remove' | 'accept' | 'decline' | null>(null);

    const status = useMemo(() => {
        if (friendsCtx.friends.some((f) => f.id === targetUserId)) {
            return 'friends' as const;
        }
        const incoming = friendsCtx.pendingRequests.find(
            (r) => r.requester.id === targetUserId,
        );
        if (incoming) return { kind: 'incoming' as const, friendshipId: incoming.id };
        const outgoing = friendsCtx.outgoingRequests.find(
            (r) => r.addresseeId === targetUserId,
        );
        if (outgoing) return 'outgoing' as const;
        return 'none' as const;
    }, [
        friendsCtx.friends,
        friendsCtx.pendingRequests,
        friendsCtx.outgoingRequests,
        targetUserId,
    ]);

    if (!isAuthenticated) {
        return (
            <Button asChild variant="outline" size="sm">
                <Link to="/login">
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Log in to add
                </Link>
            </Button>
        );
    }

    if (status === 'friends') {
        return (
            <Button
                variant="outline"
                size="sm"
                disabled={busy === 'remove'}
                onClick={async () => {
                    setBusy('remove');
                    try {
                        await friendsCtx.remove(targetUserId);
                        toast.success(`Removed @${targetUsername} from friends`);
                    } catch (err) {
                        toast.error(
                            err instanceof Error ? err.message : 'Failed to remove friend',
                        );
                    } finally {
                        setBusy(null);
                    }
                }}
            >
                <UserMinus className="mr-1.5 h-4 w-4" />
                Friends · Remove
            </Button>
        );
    }

    if (status === 'outgoing') {
        return (
            <Button variant="outline" size="sm" disabled title="Waiting for response">
                <Clock className="mr-1.5 h-4 w-4" />
                Request pending
            </Button>
        );
    }

    if (typeof status === 'object' && status.kind === 'incoming') {
        return (
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    disabled={busy === 'accept' || busy === 'decline'}
                    onClick={async () => {
                        setBusy('accept');
                        try {
                            await friendsCtx.accept(status.friendshipId);
                            toast.success(`You are now friends with @${targetUsername}`);
                        } catch (err) {
                            toast.error(
                                err instanceof Error ? err.message : 'Failed to accept',
                            );
                        } finally {
                            setBusy(null);
                        }
                    }}
                >
                    <Check className="mr-1.5 h-4 w-4" />
                    Accept
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === 'accept' || busy === 'decline'}
                    onClick={async () => {
                        setBusy('decline');
                        try {
                            await friendsCtx.decline(status.friendshipId);
                            toast.message(`Declined request from @${targetUsername}`);
                        } catch (err) {
                            toast.error(
                                err instanceof Error ? err.message : 'Failed to decline',
                            );
                        } finally {
                            setBusy(null);
                        }
                    }}
                >
                    <X className="mr-1.5 h-4 w-4" />
                    Decline
                </Button>
            </div>
        );
    }

    return (
        <Button
            size="sm"
            disabled={busy === 'add'}
            onClick={async () => {
                setBusy('add');
                try {
                    await friendsCtx.sendRequestByUsername(targetUsername);
                    toast.success(`Friend request sent to @${targetUsername}`);
                } catch (err) {
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to send request',
                    );
                } finally {
                    setBusy(null);
                }
            }}
        >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Add friend
        </Button>
    );
}
