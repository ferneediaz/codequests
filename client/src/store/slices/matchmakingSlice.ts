import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type QueueStatus = 'idle' | 'queued' | 'matched';

interface MatchmakingState {
    queueStatus: QueueStatus;
    battleId: string | null;
}

const initialState: MatchmakingState = {
    queueStatus: 'idle',
    battleId: null,
};

const matchmakingSlice = createSlice({
    name: 'matchmaking',
    initialState,
    reducers: {
        setQueued(state) {
            state.queueStatus = 'queued';
            state.battleId = null;
        },
        setMatched(state, action: PayloadAction<string>) {
            state.queueStatus = 'matched';
            state.battleId = action.payload;
        },
        resetQueue(state) {
            state.queueStatus = 'idle';
            state.battleId = null;
        },
    },
});

export const { setQueued, setMatched, resetQueue } = matchmakingSlice.actions;
export default matchmakingSlice.reducer;
