import { useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { openPaywallModal } from '@/store/slices/uiSlice';
import { useSubscription } from './useSubscription';

/**
 * Client-side paywall gate.
 *
 * Use `requireCanPlay()` before initiating any flow that the server's
 * subscription gate would reject (matchmaking queue join, private battle
 * creation, invite acceptance). Returns true when the action should
 * proceed, otherwise opens the paywall modal and routes the user to /pricing.
 *
 * The server remains the source of truth — this hook only saves the user
 * a round-trip and surfaces a friendly upgrade CTA. If the local cache is
 * stale and the server still rejects the call, the calling code should
 * fall back to its existing error handling.
 */
export function usePaywall() {
    const dispatch = useAppDispatch();
    const { status, isPro } = useSubscription();

    const requireCanPlay = useCallback((): boolean => {
        // Optimistic: if we don't have a status yet, allow the action;
        // the server will reject if needed and the caller surfaces it.
        if (!status) return true;
        if (isPro) return true;
        if (status.gamesRemaining > 0) return true;

        dispatch(openPaywallModal());
        return false;
    }, [status, isPro, dispatch]);

    /**
     * Wrap an async action with the paywall gate. Resolves to `false`
     * (without invoking `fn`) when the gate blocks; otherwise resolves
     * to the awaited result of `fn`.
     */
    const guard = useCallback(
        async <T,>(fn: () => Promise<T>): Promise<T | false> => {
            if (!requireCanPlay()) return false;
            return fn();
        },
        [requireCanPlay],
    );

    return { requireCanPlay, guard };
}
