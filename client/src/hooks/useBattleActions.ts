import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setIsRunning, setIsSubmitting } from '@/store/slices/battleSlice';
import { battlesApi } from '@/services/battles';
import { getSocket } from '@/services/socket';
import type { ProblemResponse, SkillType, SubmissionResult } from '@/types/api';

export function useBattleActions(
    battleId: string,
    problem: ProblemResponse | undefined,
    userId: string | undefined,
) {
    const dispatch = useAppDispatch();
    const queryClient = useQueryClient();
    const { isSubmitting, isRunning, usedSkills, activeEffects } = useAppSelector(
        (state) => state.battle,
    );
    const [lastSubmissionResultState, setLastSubmissionResult] = useState<{
        battleId: string;
        result: SubmissionResult;
    } | null>(null);
    const [runResultState, setRunResult] = useState<{
        battleId: string;
        result: SubmissionResult;
    } | null>(null);
    const lastSubmissionResult =
        lastSubmissionResultState?.battleId === battleId
            ? lastSubmissionResultState.result
            : null;
    const runResult =
        runResultState?.battleId === battleId ? runResultState.result : null;

    const submitCode = useCallback(
        async (code: string, language: string) => {
            dispatch(setIsSubmitting(true));
            try {
                const result = await battlesApi.submitCode(battleId, { code, language });
                setLastSubmissionResult({ battleId, result });
                return result;
            } finally {
                dispatch(setIsSubmitting(false));
            }
        },
        [battleId, dispatch],
    );

    const runCode = useCallback(
        async (code: string, language: string) => {
            if (!problem) return;
            dispatch(setIsRunning(true));
            try {
                const result = await battlesApi.executeProblem(problem.id, {
                    code,
                    language,
                });
                setRunResult({ battleId, result });
                return result;
            } finally {
                dispatch(setIsRunning(false));
            }
        },
        [battleId, problem, dispatch],
    );

    const useSkill = useCallback(
        (skillType: SkillType, targetUserId: string) => {
            const socket = getSocket();
            if (socket) {
                socket.emit('skill.use', { battleId, targetUserId, skillType });
            }
        },
        [battleId],
    );

    const completeBattle = useCallback(async () => {
        try {
            await battlesApi.completeBattle(battleId);
            if (userId) {
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.userStats(userId),
                });
                await queryClient.invalidateQueries({
                    queryKey: queryKeys.matchHistory(userId),
                });
            }
        } catch (error) {
            console.error('Failed to complete battle:', error);
        }
    }, [battleId, queryClient, userId]);

    const readyUp = useCallback(() => {
        const socket = getSocket();
        if (socket) {
            socket.emit('battle.ready', { battleId });
        }
    }, [battleId]);

    const unready = useCallback(() => {
        const socket = getSocket();
        if (socket) {
            socket.emit('battle.unready', { battleId });
        }
    }, [battleId]);

    return {
        lastSubmissionResult,
        runResult,
        isSubmitting,
        isRunning,
        usedSkills,
        activeEffects,
        submitCode,
        runCode,
        useSkill,
        completeBattle,
        readyUp,
        unready,
    };
}
