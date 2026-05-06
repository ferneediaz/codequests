import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    clearSubscription,
    setSubscriptionError,
    setSubscriptionLoading,
    setSubscriptionStatus,
} from '@/store/slices/subscriptionSlice';
import { subscriptionsApi } from '@/services/subscriptions';

const REFRESH_THROTTLE_MS = 15_000;

/**
 * Subscription state + helpers.
 *
 * Fetches `/subscriptions/status` after the user signs in and exposes
 * derived booleans (`isPro`, `isDev`, `canPlay`) plus a manual `refresh`
 * method for callers that just changed the underlying state (e.g. after
 * returning from Stripe checkout, or after a battle starts).
 *
 * The fetch is throttled so the various entry points that call this hook
 * (Navbar, paywall gate, dashboard) don't hammer the API on every render.
 */
export function useSubscription() {
    const dispatch = useAppDispatch();
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);
    const { status, isLoading, lastFetchedAt } = useAppSelector(
        (state) => state.subscription,
    );
    const inFlightRef = useRef<Promise<void> | null>(null);
    const lastFetchedAtRef = useRef(lastFetchedAt);

    useEffect(() => {
        lastFetchedAtRef.current = lastFetchedAt;
    }, [lastFetchedAt]);

    const fetchStatus = useCallback(
        async (force = false) => {
            if (!isAuthenticated) return;
            if (
                !force &&
                lastFetchedAtRef.current &&
                Date.now() - lastFetchedAtRef.current < REFRESH_THROTTLE_MS
            ) {
                return;
            }
            if (inFlightRef.current) return inFlightRef.current;

            dispatch(setSubscriptionLoading(true));
            const promise = (async () => {
                try {
                    const data = await subscriptionsApi.getStatus();
                    dispatch(setSubscriptionStatus(data));
                } catch (err: unknown) {
                    const message =
                        (err as { response?: { data?: { message?: string } } })
                            ?.response?.data?.message ??
                        'Failed to load subscription status';
                    dispatch(setSubscriptionError(message));
                } finally {
                    inFlightRef.current = null;
                }
            })();
            inFlightRef.current = promise;
            return promise;
        },
        [dispatch, isAuthenticated],
    );

    // Fetch on sign-in; clear on sign-out. We intentionally key on
    // `user?.id` rather than `isAuthenticated` so a session change between
    // two different accounts (rare, but possible during dev) refetches.
    useEffect(() => {
        if (isAuthenticated && user?.id) {
            void fetchStatus(true);
        } else if (!isAuthenticated) {
            dispatch(clearSubscription());
        }
    }, [isAuthenticated, user?.id, dispatch, fetchStatus]);

    const derived = useMemo(() => {
        const tier = status?.tier ?? 'free';
        const source = status?.source;
        const isPro = tier === 'pro' || tier === 'trial';
        const isDev = source === 'dev';
        // canPlay is a render-time hint; the server is the source of truth
        // and will reject the underlying API call if the limit is reached.
        const canPlay =
            isPro || (status?.gamesRemaining ?? 1) > 0 || status === null;
        return { tier, source, isPro, isDev, canPlay };
    }, [status]);

    return {
        status,
        isLoading,
        refresh: () => fetchStatus(true),
        ...derived,
    };
}
