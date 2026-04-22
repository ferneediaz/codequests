import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SubscriptionStatus } from '@/types/subscription';

interface SubscriptionState {
    status: SubscriptionStatus | null;
    isLoading: boolean;
    /** Last fetch error message (for diagnostics; UI hides errors silently). */
    error: string | null;
    /** Epoch ms of the last successful fetch, used to throttle refetches. */
    lastFetchedAt: number | null;
}

const initialState: SubscriptionState = {
    status: null,
    isLoading: false,
    error: null,
    lastFetchedAt: null,
};

const subscriptionSlice = createSlice({
    name: 'subscription',
    initialState,
    reducers: {
        setSubscriptionLoading(state, action: PayloadAction<boolean>) {
            state.isLoading = action.payload;
            if (action.payload) state.error = null;
        },
        setSubscriptionStatus(state, action: PayloadAction<SubscriptionStatus>) {
            state.status = action.payload;
            state.isLoading = false;
            state.error = null;
            state.lastFetchedAt = Date.now();
        },
        setSubscriptionError(state, action: PayloadAction<string>) {
            state.isLoading = false;
            state.error = action.payload;
        },
        clearSubscription(state) {
            state.status = null;
            state.isLoading = false;
            state.error = null;
            state.lastFetchedAt = null;
        },
    },
});

export const {
    setSubscriptionLoading,
    setSubscriptionStatus,
    setSubscriptionError,
    clearSubscription,
} = subscriptionSlice.actions;

export default subscriptionSlice.reducer;
