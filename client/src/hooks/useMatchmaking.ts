import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setQueued, setMatched, resetQueue } from '@/store/slices/matchmakingSlice';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import type { MatchFoundPayload } from '@/types/socket';
import type { MatchConfig } from '@/types/api';
import { usePaywall } from './usePaywall';
import { useSubscription } from './useSubscription';

export function useMatchmaking() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { queueStatus, battleId } = useAppSelector((state) => state.matchmaking);
    const navigatedRef = useRef(false);
    const { requireCanPlay } = usePaywall();
    const { refresh: refreshSubscription } = useSubscription();

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleMatchFound = (data: MatchFoundPayload) => {
            dispatch(setMatched(data.battleId));
            if (!navigatedRef.current) {
                navigatedRef.current = true;
                navigate(`/battle/${data.battleId}`);
            }
        };

        socket.on('matchmaking.match_found', handleMatchFound);

        return () => {
            socket.off('matchmaking.match_found', handleMatchFound);
        };
    }, [dispatch, navigate]);

    const joinQueue = useCallback(async (config?: MatchConfig) => {
        // Defensive gate: most callers gate before navigating to
        // /matchmaking, but this catches direct URL access too. The
        // paywall hook surfaces an upgrade toast and we propagate a
        // synthetic rejection so the caller can route the user away.
        if (!requireCanPlay()) {
            throw new Error('paywall');
        }
        try {
            await api.post('/matchmaking/queue', {
                mode: config?.mode ?? 'ONE_V_ONE',
                preferredDifficulty: config?.preferredDifficulty,
                preferredTopic: config?.preferredTopic,
            });
            dispatch(setQueued());
            navigatedRef.current = false;
            void refreshSubscription();
        } catch (error) {
            console.error('Failed to join queue:', error);
            throw error;
        }
    }, [dispatch, requireCanPlay, refreshSubscription]);

    const leaveQueue = useCallback(async () => {
        try {
            await api.delete('/matchmaking/queue');
            dispatch(resetQueue());
        } catch (error) {
            console.error('Failed to leave queue:', error);
        }
    }, [dispatch]);

    return {
        queueStatus,
        battleId,
        joinQueue,
        leaveQueue,
    };
}
