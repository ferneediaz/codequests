import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BattleResponse, ProblemResponse, SubmissionResult } from '@/types/api';

interface OpponentProgress {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
}

interface BattleState {
    battle: BattleResponse | null;
    problem: ProblemResponse | null;
    opponentProgress: OpponentProgress | null;
    lastSubmissionResult: SubmissionResult | null;
    isSubmitting: boolean;
}

const initialState: BattleState = {
    battle: null,
    problem: null,
    opponentProgress: null,
    lastSubmissionResult: null,
    isSubmitting: false,
};

const battleSlice = createSlice({
    name: 'battle',
    initialState,
    reducers: {
        setBattle(state, action: PayloadAction<BattleResponse>) {
            state.battle = action.payload;
        },
        setProblem(state, action: PayloadAction<ProblemResponse>) {
            state.problem = action.payload;
        },
        setOpponentProgress(state, action: PayloadAction<OpponentProgress>) {
            state.opponentProgress = action.payload;
        },
        setSubmissionResult(state, action: PayloadAction<SubmissionResult>) {
            state.lastSubmissionResult = action.payload;
            state.isSubmitting = false;
        },
        setIsSubmitting(state, action: PayloadAction<boolean>) {
            state.isSubmitting = action.payload;
        },
        updateBattleStatus(state, action: PayloadAction<BattleResponse['status']>) {
            if (state.battle) {
                state.battle.status = action.payload;
            }
        },
        completeBattle(state, action: PayloadAction<BattleResponse>) {
            state.battle = action.payload;
        },
        resetBattle() {
            return initialState;
        },
    },
});

export const {
    setBattle,
    setProblem,
    setOpponentProgress,
    setSubmissionResult,
    setIsSubmitting,
    updateBattleStatus,
    completeBattle,
    resetBattle,
} = battleSlice.actions;
export default battleSlice.reducer;
