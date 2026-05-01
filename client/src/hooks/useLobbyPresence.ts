import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/services/socket';
import { getLobbySnapshot } from '@/services/lobby';
import type {
    LobbySnapshot,
    LobbyPresenceDelta,
    LobbyUser,
} from '@/types/lobby';

interface UseLobbyPresenceResult {
    snapshot: LobbySnapshot | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    patchUser: (userId: string, patch: Partial<LobbyUser>) => void;
}

/**
 * Subscribe to the lobby presence room and maintain a live snapshot.
 *
 * Flow:
 *  1. Fetch REST snapshot on mount to hydrate the lists immediately.
 *  2. Emit `lobby.subscribe` on the /battles socket so the server starts
 *     pushing `lobby.presence_delta` events to us.
 *  3. Merge online/offline deltas into local state optimistically.
 *  4. Emit `lobby.unsubscribe` on unmount so the server stops pushing.
 */
export function useLobbyPresence(): UseLobbyPresenceResult {
    const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const subscribedRef = useRef(false);

    // Manual refresh handler. The setState calls happen *after* the async
    // boundary, which the lint rule allows.
    const refresh = useCallback(async () => {
        try {
            const data = await getLobbySnapshot();
            setSnapshot(data);
            setError(null);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to load lobby.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const patchUser = useCallback(
        (userId: string, patch: Partial<LobbyUser>) => {
            setSnapshot((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    users: prev.users.map((u) =>
                        u.id === userId ? { ...u, ...patch } : u,
                    ),
                };
            });
        },
        [],
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await getLobbySnapshot();
                if (cancelled) return;
                setSnapshot(data);
                setError(null);
            } catch (err: unknown) {
                if (cancelled) return;
                const message =
                    (err as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ?? 'Failed to load lobby.';
                setError(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const subscribe = () => {
            if (subscribedRef.current) return;
            socket.emit('lobby.subscribe', null, (resp: { success: boolean }) => {
                if (resp?.success) subscribedRef.current = true;
            });
        };

        if (socket.connected) subscribe();
        else socket.once('connect', subscribe);

        const handleDelta = (delta: LobbyPresenceDelta) => {
            setSnapshot((prev) => {
                if (!prev) return prev;
                if (delta.type === 'online') {
                    // Skip if already in the list (e.g. transient reconnect)
                    if (prev.users.some((u) => u.id === delta.user.id)) {
                        return prev;
                    }
                    const newUser: LobbyUser = {
                        ...delta.user,
                        friendship: 'NONE',
                    };
                    return {
                        ...prev,
                        users: [...prev.users, newUser].sort(
                            (a, b) => b.mmr - a.mmr,
                        ),
                        onlineCount: prev.onlineCount + 1,
                    };
                }
                // offline
                return {
                    ...prev,
                    users: prev.users.filter((u) => u.id !== delta.user.id),
                    onlineCount: Math.max(0, prev.onlineCount - 1),
                };
            });
        };

        socket.on('lobby.presence_delta', handleDelta);

        return () => {
            socket.off('lobby.presence_delta', handleDelta);
            socket.off('connect', subscribe);
            if (subscribedRef.current) {
                socket.emit('lobby.unsubscribe');
                subscribedRef.current = false;
            }
        };
    }, []);

    return { snapshot, loading, error, refresh, patchUser };
}
