import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSocket } from '@/services/socket';
import {
    acceptFriendRequest,
    declineFriendRequest,
    listFriends,
    listPendingRequests,
    removeFriend,
    sendFriendRequestByUsername,
    type FriendRecord,
    type PendingRequest,
} from '@/services/friends';
import { useAppSelector } from '@/store/hooks';
import { queryKeys } from '@/lib/queryKeys';
import type { LobbyUser } from '@/types/lobby';
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
 * Owns the client-side friends facade: accepted friends, incoming
 * requests, local outgoing requests, notification counts, and friend
 * presence. Server-backed lists live in TanStack Query; ephemeral UI
 * state stays local to this provider.
 */
export function FriendNotificationsProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);
    const queryClient = useQueryClient();
    const [recentAccepted, setRecentAccepted] = useState<FriendRequestAcceptedPayload[]>(
        [],
    );
    const [outgoingRequests, setOutgoingRequests] = useState<
        FriendNotificationsContextValue['outgoingRequests']
    >([]);
    const [onlineFriendIds, setOnlineFriendIds] = useState<Set<string>>(
        () => new Set(),
    );
    // Tracks how many notifications the user has not yet seen. Resets to
    // 0 when they open the notification panel via `markAllSeen`.
    const [unseenPending, setUnseenPending] = useState(0);
    const [unseenAccepted, setUnseenAccepted] = useState(0);

    const friendsQuery = useQuery({
        queryKey: queryKeys.friends.list(),
        queryFn: listFriends,
        enabled: isAuthenticated,
    });

    const incomingQuery = useQuery({
        queryKey: queryKeys.friends.incoming(),
        queryFn: listPendingRequests,
        enabled: isAuthenticated,
    });

    const friends = useMemo(() => friendsQuery.data ?? [], [friendsQuery.data]);
    const pendingRequests = useMemo(
        () => incomingQuery.data ?? [],
        [incomingQuery.data],
    );

    const refresh = useCallback(async () => {
        if (!isAuthenticated) return;
        await Promise.all([friendsQuery.refetch(), incomingQuery.refetch()]);
    }, [friendsQuery, incomingQuery, isAuthenticated]);

    const upsertIncomingRequest = useCallback(
        (entry: PendingRequest) => {
            queryClient.setQueryData<PendingRequest[]>(
                queryKeys.friends.incoming(),
                (prev = []) => {
                    if (prev.some((r) => r.id === entry.id)) return prev;
                    return [entry, ...prev];
                },
            );
        },
        [queryClient],
    );

    const removeIncomingRequest = useCallback(
        (friendshipId: string) => {
            queryClient.setQueryData<PendingRequest[]>(
                queryKeys.friends.incoming(),
                (prev = []) => prev.filter((r) => r.id !== friendshipId),
            );
        },
        [queryClient],
    );

    const removeOutgoingRequest = useCallback((friendshipId: string) => {
        setOutgoingRequests((prev) =>
            prev.filter((r) => r.friendshipId !== friendshipId),
        );
    }, []);

    const wasAuthenticatedRef = useRef(false);
    useEffect(() => {
        let cancelled = false;
        if (isAuthenticated && user?.id) {
            wasAuthenticatedRef.current = true;
        } else if (wasAuthenticatedRef.current) {
            wasAuthenticatedRef.current = false;
            queueMicrotask(() => {
                if (cancelled) return;
                setRecentAccepted([]);
                setOutgoingRequests([]);
                setOnlineFriendIds(new Set());
                setUnseenPending(0);
                setUnseenAccepted(0);
                queryClient.removeQueries({ queryKey: queryKeys.friends.list() });
                queryClient.removeQueries({
                    queryKey: queryKeys.friends.incoming(),
                });
            });
        }
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, queryClient, user?.id]);

    // Socket subscriptions. We attach once the socket is available after
    // sign-in. The /battles namespace is where the server pushes friend
    // lifecycle events and per-friend presence updates.
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
                upsertIncomingRequest(entry);
                setUnseenPending((n) => n + 1);
                toast.info(`${data.requesterUsername} sent you a friend request.`);
            };

            const handleAccepted = (data: FriendRequestAcceptedPayload) => {
                removeOutgoingRequest(data.friendshipId);
                void queryClient.invalidateQueries({
                    queryKey: queryKeys.friends.list(),
                });
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
                removeOutgoingRequest(data.friendshipId);
                // Subtle acknowledgement for the requester. We don't surface
                // declines in the persistent panel to avoid making them
                // feel permanent; a one-off toast is enough.
                toast.message(`${data.addresseeUsername} declined your friend request.`);
            };

            const handlePresenceOnline = (data: { userId: string }) => {
                setOnlineFriendIds((prev) => {
                    if (prev.has(data.userId)) return prev;
                    const next = new Set(prev);
                    next.add(data.userId);
                    return next;
                });
            };

            const handlePresenceOffline = (data: { userId: string }) => {
                setOnlineFriendIds((prev) => {
                    if (!prev.has(data.userId)) return prev;
                    const next = new Set(prev);
                    next.delete(data.userId);
                    return next;
                });
            };

            const handleDisconnect = () => {
                setOnlineFriendIds(new Set());
            };

            socket.on('friend.request_received', handleReceived);
            socket.on('friend.request_accepted', handleAccepted);
            socket.on('friend.request_declined', handleDeclined);
            socket.on('presence.online', handlePresenceOnline);
            socket.on('presence.offline', handlePresenceOffline);
            socket.on('disconnect', handleDisconnect);
            socketBoundRef.current = true;

            detach = () => {
                socket.off('friend.request_received', handleReceived);
                socket.off('friend.request_accepted', handleAccepted);
                socket.off('friend.request_declined', handleDeclined);
                socket.off('presence.online', handlePresenceOnline);
                socket.off('presence.offline', handlePresenceOffline);
                socket.off('disconnect', handleDisconnect);
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
    }, [
        isAuthenticated,
        queryClient,
        removeOutgoingRequest,
        upsertIncomingRequest,
        user?.id,
    ]);

    // Drop stale presence entries when a friend is removed or the accepted
    // list refreshes after login.
    useEffect(() => {
        let cancelled = false;
        const friendIds = new Set(friends.map((friend) => friend.id));
        queueMicrotask(() => {
            if (cancelled) return;
            setOnlineFriendIds((prev) => {
                const next = new Set(
                    [...prev].filter((friendId) => friendIds.has(friendId)),
                );
                if (next.size === prev.size) return prev;
                return next;
            });
        });
        return () => {
            cancelled = true;
        };
    }, [friends]);

    const accept = useCallback(async (friendshipId: string) => {
        try {
            await acceptFriendRequest(friendshipId);
            removeIncomingRequest(friendshipId);
            await queryClient.invalidateQueries({
                queryKey: queryKeys.friends.list(),
            });
            setUnseenPending((n) => Math.max(0, n - 1));
            toast.success('Friend request accepted.');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to accept request.';
            toast.error(message);
            throw err;
        }
    }, [queryClient, removeIncomingRequest]);

    const decline = useCallback(async (friendshipId: string) => {
        try {
            await declineFriendRequest(friendshipId);
            removeIncomingRequest(friendshipId);
            setUnseenPending((n) => Math.max(0, n - 1));
            toast.message('Friend request declined.');
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to decline request.';
            toast.error(message);
            throw err;
        }
    }, [removeIncomingRequest]);

    const remove = useCallback(
        async (friendUserId: string) => {
            try {
                await removeFriend(friendUserId);
                queryClient.setQueryData<FriendRecord[]>(
                    queryKeys.friends.list(),
                    (prev = []) =>
                        prev.filter((friend) => friend.id !== friendUserId),
                );
                setOnlineFriendIds((prev) => {
                    const next = new Set(prev);
                    next.delete(friendUserId);
                    return next;
                });
                toast.success('Friend removed.');
            } catch (err: unknown) {
                const message =
                    (err as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ?? 'Failed to remove friend.';
                toast.error(message);
                throw err;
            }
        },
        [queryClient],
    );

    const sendRequestByUsername = useCallback(async (username: string) => {
        const normalized = username.trim();
        if (!normalized) return;
        try {
            const request = await sendFriendRequestByUsername(normalized);
            setOutgoingRequests((prev) => {
                if (prev.some((r) => r.friendshipId === request.id)) return prev;
                return [
                    {
                        friendshipId: request.id,
                        addresseeId: request.addressee.id,
                        username: request.addressee.username,
                        avatarUrl: request.addressee.avatarUrl ?? null,
                        mmr: request.addressee.mmr,
                        createdAt: request.createdAt,
                    },
                    ...prev,
                ];
            });
            toast.success(`Friend request sent to ${request.addressee.username}.`);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to send friend request.';
            toast.error(message);
            throw err;
        }
    }, []);

    const seedOutgoingRequest = useCallback((target: LobbyUser) => {
        const friendshipId = target.friendshipId;
        if (!friendshipId) return;
        setOutgoingRequests((prev) => {
            if (prev.some((r) => r.friendshipId === friendshipId)) {
                return prev;
            }
            return [
                {
                    friendshipId,
                    addresseeId: target.id,
                    username: target.username,
                    avatarUrl: target.avatarUrl ?? null,
                    mmr: target.mmr,
                    createdAt: new Date().toISOString(),
                },
                ...prev,
            ];
        });
    }, []);

    const markAllSeen = useCallback(() => {
        setUnseenPending(0);
        setUnseenAccepted(0);
    }, []);

    const isFriendOnline = useCallback(
        (friendUserId: string) => onlineFriendIds.has(friendUserId),
        [onlineFriendIds],
    );

    const value = useMemo<FriendNotificationsContextValue>(
        () => ({
            friends,
            onlineFriendIds,
            pendingRequests,
            outgoingRequests,
            recentAccepted,
            unreadCount: unseenPending + unseenAccepted,
            loading: friendsQuery.isLoading || incomingQuery.isLoading,
            refresh,
            accept,
            decline,
            remove,
            sendRequestByUsername,
            seedOutgoingRequest,
            isFriendOnline,
            markAllSeen,
        }),
        [
            friends,
            onlineFriendIds,
            pendingRequests,
            outgoingRequests,
            recentAccepted,
            unseenPending,
            unseenAccepted,
            friendsQuery.isLoading,
            incomingQuery.isLoading,
            refresh,
            accept,
            decline,
            remove,
            sendRequestByUsername,
            seedOutgoingRequest,
            isFriendOnline,
            markAllSeen,
        ],
    );

    return (
        <FriendNotificationsContext.Provider value={value}>
            {children}
        </FriendNotificationsContext.Provider>
    );
}
