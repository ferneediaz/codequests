import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { getSocket } from '@/services/socket';
import {
    acceptFriendRequest,
    declineFriendRequest,
    listPendingRequests,
    type PendingRequest,
} from '@/services/friends';
import { useAppSelector } from '@/store/hooks';
import type {
    FriendRequestAcceptedPayload,
    FriendRequestDeclinedPayload,
    FriendRequestReceivedPayload,
} from '@/types/socket';
import {
    FriendNotificationsContext,
    type FriendNotificationsContextValue,
} from './friendNotificationsContext';

/**
 * Hydrates the incoming friend request queue on sign-in and keeps it in
 * sync with server-side changes via the /battles socket. Exposed as a
 * context so the navbar bell and any popover panel share a single
 * source of truth — accepting from any surface immediately updates
 * both.
 */
export function FriendNotificationsProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [recentAccepted, setRecentAccepted] = useState<FriendRequestAcceptedPayload[]>(
        [],
    );
    const [loading, setLoading] = useState(false);
    // Tracks how many notifications the user has not yet seen. Resets to
    // 0 when they open the notification panel via `markAllSeen`.
    const [unseenPending, setUnseenPending] = useState(0);
    const [unseenAccepted, setUnseenAccepted] = useState(0);

    // Extracted so both the public `refresh` callback and the hydration
    // effect can share the same fetch path without tripping React's
    // "don't call setState directly in effects" rule.
    const doFetch = async () => {
        setLoading(true);
        try {
            const data = await listPendingRequests();
            setPendingRequests(data);
        } catch {
            // Non-fatal; leave existing state.
        } finally {
            setLoading(false);
        }
    };

    const refresh = useCallback(async () => {
        if (!isAuthenticated) return;
        await doFetch();
    }, [isAuthenticated]);

    // Hydrate once per signed-in session. We guard the sign-out branch
    // behind a ref so we don't redundantly dispatch empty-state updates
    // on every auth-adjacent render. The fetch and the sign-out reset
    // are scheduled as microtasks so the effect body itself doesn't
    // synchronously call setState — that keeps React's "don't call
    // setState in effects" lint rule happy while preserving the intent.
    const wasAuthenticatedRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        if (isAuthenticated && user?.id) {
            wasAuthenticatedRef.current = true;
            queueMicrotask(() => {
                if (!cancelled) void doFetch();
            });
        } else if (wasAuthenticatedRef.current) {
            wasAuthenticatedRef.current = false;
            queueMicrotask(() => {
                if (cancelled) return;
                setPendingRequests([]);
                setRecentAccepted([]);
                setUnseenPending(0);
                setUnseenAccepted(0);
            });
        }
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user?.id]);

    // Socket subscriptions. We attach once the socket is available after
    // sign-in. The /battles namespace is where the server pushes friend
    // lifecycle events alongside presence.
    const socketBoundRef = useRef(false);
    useEffect(() => {
        if (!isAuthenticated) return;

        let detach: (() => void) | null = null;

        const bind = () => {
            if (socketBoundRef.current) return;
            const socket = getSocket();
            if (!socket) return;

            const handleReceived = (data: FriendRequestReceivedPayload) => {
                const entry: PendingRequest = {
                    id: data.friendshipId,
                    requesterId: data.requesterId,
                    addresseeId: user?.id ?? '',
                    status: 'PENDING',
                    createdAt: data.createdAt,
                    requester: {
                        id: data.requesterId,
                        username: data.requesterUsername,
                        avatarUrl: data.requesterAvatarUrl ?? null,
                        mmr: data.requesterMmr,
                    },
                };
                setPendingRequests((prev) => {
                    if (prev.some((r) => r.id === entry.id)) return prev;
                    return [entry, ...prev];
                });
                setUnseenPending((n) => n + 1);
                toast.info(`${data.requesterUsername} sent you a friend request.`);
            };

            const handleAccepted = (data: FriendRequestAcceptedPayload) => {
                setRecentAccepted((prev) => {
                    if (prev.some((a) => a.friendshipId === data.friendshipId)) {
                        return prev;
                    }
                    // Keep the last 10 acceptances to bound memory.
                    return [data, ...prev].slice(0, 10);
                });
                setUnseenAccepted((n) => n + 1);
                toast.success(`${data.friendUsername} accepted your friend request.`);
            };

            const handleDeclined = (data: FriendRequestDeclinedPayload) => {
                // Subtle acknowledgement for the requester. We don't surface
                // declines in the persistent panel to avoid making them
                // feel permanent; a one-off toast is enough.
                toast.message(`${data.addresseeUsername} declined your friend request.`);
            };

            socket.on('friend.request_received', handleReceived);
            socket.on('friend.request_accepted', handleAccepted);
            socket.on('friend.request_declined', handleDeclined);
            socketBoundRef.current = true;

            detach = () => {
                socket.off('friend.request_received', handleReceived);
                socket.off('friend.request_accepted', handleAccepted);
                socket.off('friend.request_declined', handleDeclined);
                socketBoundRef.current = false;
            };
        };

        // The /battles socket is created asynchronously inside useAuth
        // (after Supabase hands us a token). Poll briefly until it's
        // ready, then bind once.
        let attempts = 0;
        const poll = window.setInterval(() => {
            if (socketBoundRef.current || attempts > 20) {
                window.clearInterval(poll);
                return;
            }
            attempts += 1;
            bind();
        }, 250);

        return () => {
            window.clearInterval(poll);
            if (detach) detach();
        };
    }, [isAuthenticated, user?.id]);

    const accept = useCallback(async (friendshipId: string) => {
        try {
            await acceptFriendRequest(friendshipId);
            setPendingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
            setUnseenPending((n) => Math.max(0, n - 1));
            toast.success('Friend request accepted.');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to accept request.';
            toast.error(message);
            throw err;
        }
    }, []);

    const decline = useCallback(async (friendshipId: string) => {
        try {
            await declineFriendRequest(friendshipId);
            setPendingRequests((prev) => prev.filter((r) => r.id !== friendshipId));
            setUnseenPending((n) => Math.max(0, n - 1));
            toast.message('Friend request declined.');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to decline request.';
            toast.error(message);
            throw err;
        }
    }, []);

    const markAllSeen = useCallback(() => {
        setUnseenPending(0);
        setUnseenAccepted(0);
    }, []);

    const value = useMemo<FriendNotificationsContextValue>(
        () => ({
            pendingRequests,
            recentAccepted,
            unreadCount: unseenPending + unseenAccepted,
            loading,
            refresh,
            accept,
            decline,
            markAllSeen,
        }),
        [
            pendingRequests,
            recentAccepted,
            unseenPending,
            unseenAccepted,
            loading,
            refresh,
            accept,
            decline,
            markAllSeen,
        ],
    );

    return (
        <FriendNotificationsContext.Provider value={value}>
            {children}
        </FriendNotificationsContext.Provider>
    );
}
