import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SkillType } from '@/types/api';

interface ActiveEffect {
    skillType: SkillType;
    expiresAt: number;
}

interface BattleState {
    isSubmitting: boolean;
    isRunning: boolean;
    usedSkills: SkillType[];
    activeEffects: ActiveEffect[];
}

const initialState: BattleState = {
    isSubmitting: false,
    isRunning: false,
    usedSkills: [],
    activeEffects: [],
};

const battleSlice = createSlice({
    name: 'battle',
    initialState,
    reducers: {
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
        resetBattle() {
            return initialState;
        },
    },
});

export const {
    setIsSubmitting,
    setIsRunning,
    addUsedSkill,
    addActiveEffect,
    removeActiveEffect,
    resetBattle,
} = battleSlice.actions;
export default battleSlice.reducer;
