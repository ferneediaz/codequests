import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import battleReducer from './slices/battleSlice';
import matchmakingReducer from './slices/matchmakingSlice';
import subscriptionReducer from './slices/subscriptionSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        battle: battleReducer,
        matchmaking: matchmakingReducer,
        subscription: subscriptionReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
