import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setQueued, setMatched, resetQueue } from '@/store/slices/matchmakingSlice';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import type { MatchFoundPayload } from '@/types/socket';
import type { MatchConfig, BattleMode, BattleStatus } from '@/types/api';
import { usePaywall } from './usePaywall';
import { useSubscription } from './useSubscription';

/**
 * Structured error raised when /matchmaking/queue rejects. Pages (currently
 * Matchmaking.tsx) pattern-match on `code` to render actionable UI instead of
 * bouncing the user silently back to /play.
 *
 * Codes:
 *  - `PAYWALL`   : client-side paywall gate blocked the request.
 *  - `ACTIVE_BATTLE` : server rejected because the user is in an active
 *                     battle. Includes enough context to resume it.
 *  - `GENERIC`   : anything else (network, 5xx, validation).
 */
export type JoinQueueErrorCode = 'PAYWALL' | 'ACTIVE_BATTLE' | 'GENERIC';

export interface JoinQueueError extends Error {
    code: JoinQueueErrorCode;
    battleId?: string;
    battleStatus?: BattleStatus;
    battleMode?: BattleMode;
}

function createJoinQueueError(
    code: JoinQueueErrorCode,
    message: string,
    extras?: Partial<JoinQueueError>,
): JoinQueueError {
    const err = new Error(message) as JoinQueueError;
    err.name = 'JoinQueueError';
    err.code = code;
    if (extras?.battleId) err.battleId = extras.battleId;
    if (extras?.battleStatus) err.battleStatus = extras.battleStatus;
    if (extras?.battleMode) err.battleMode = extras.battleMode;
    return err;
}

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
        // paywall hook surfaces an upgrade toast; we still throw a typed
        // error so the page can render an inline explanation rather than
        // relying solely on the transient toast.
        if (!requireCanPlay()) {
            throw createJoinQueueError(
                'PAYWALL',
                "You've used up your free games for today. Upgrade or come back tomorrow.",
            );
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

            // The server returns a structured 400 payload when the user is
            // already in an active battle (see MatchmakingService.joinQueue).
            // NestJS wraps object bodies as `{ statusCode, message, ... }`, so
            // the extra fields (`code`, `battleId`, ...) sit on `response.data`.
            const data = (error as {
                response?: {
                    data?: {
                        code?: string;
                        message?: string | string[];
                        battleId?: string;
                        battleStatus?: BattleStatus;
                        battleMode?: BattleMode;
                    };
                };
            }).response?.data;

            const rawMessage = data?.message;
            const message = Array.isArray(rawMessage)
                ? rawMessage.join(', ')
                : rawMessage;

            if (data?.code === 'ACTIVE_BATTLE' && data.battleId) {
                throw createJoinQueueError(
                    'ACTIVE_BATTLE',
                    message ??
                        'You are already in an active battle. Resume or finish it first.',
                    {
                        battleId: data.battleId,
                        battleStatus: data.battleStatus,
                        battleMode: data.battleMode,
                    },
                );
            }

            throw createJoinQueueError(
                'GENERIC',
                message ?? 'Could not join matchmaking. Please try again.',
            );
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
