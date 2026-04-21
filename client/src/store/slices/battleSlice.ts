import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { BattleResponse, ProblemResponse, SubmissionResult, SkillType } from '@/types/api';

interface OpponentProgress {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
}

interface ActiveEffect {
    skillType: SkillType;
    expiresAt: number;
}

interface BattleState {
    battle: BattleResponse | null;
    problem: ProblemResponse | null;
    opponentProgress: OpponentProgress | null;
    lastSubmissionResult: SubmissionResult | null;
    runResult: SubmissionResult | null;
    isSubmitting: boolean;
    isRunning: boolean;
    usedSkills: SkillType[];
    activeEffects: ActiveEffect[];
}

const initialState: BattleState = {
    battle: null,
    problem: null,
    opponentProgress: null,
    lastSubmissionResult: null,
    runResult: null,
    isSubmitting: false,
    isRunning: false,
    usedSkills: [],
    activeEffects: [],
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
        setRunResult(state, action: PayloadAction<SubmissionResult>) {
            state.runResult = action.payload;
            state.isRunning = false;
        },
        setIsSubmitting(state, action: PayloadAction<boolean>) {
            state.isSubmitting = action.payload;
        },
        setIsRunning(state, action: PayloadAction<boolean>) {
            state.isRunning = action.payload;
        },
        addUsedSkill(state, action: PayloadAction<SkillType>) {
            if (!state.usedSkills.includes(action.payload)) {
                state.usedSkills.push(action.payload);
            }
        },
        addActiveEffect(state, action: PayloadAction<ActiveEffect>) {
            state.activeEffects.push(action.payload);
        },
        removeActiveEffect(state, action: PayloadAction<SkillType>) {
            state.activeEffects = state.activeEffects.filter(
                (e) => e.skillType !== action.payload,
            );
        },
        updateBattleStatus(state, action: PayloadAction<BattleResponse['status']>) {
            if (state.battle) {
                state.battle.status = action.payload;
            }
        },
        completeBattle(state, action: PayloadAction<BattleResponse>) {
            state.battle = action.payload;
        },
        setBattleStartedAt(state, action: PayloadAction<string>) {
            if (state.battle) {
                state.battle.startedAt = action.payload;
            }
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
    setRunResult,
    setIsSubmitting,
    setIsRunning,
    addUsedSkill,
    addActiveEffect,
    removeActiveEffect,
    updateBattleStatus,
    completeBattle,
    setBattleStartedAt,
    resetBattle,
} = battleSlice.actions;
export default battleSlice.reducer;
