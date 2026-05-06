import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    setIsSubmitting,
    setIsRunning,
    addUsedSkill,
    addActiveEffect,
    removeActiveEffect,
    resetBattle,
} from '@/store/slices/battleSlice';
import { battlesApi } from '@/services/battles';
import { getSocket } from '@/services/socket';
import type { BattleResponse, ProblemResponse, SkillType, SubmissionResult } from '@/types/api';
import type {
    BattleStartedPayload,
    BattleSubmissionPayload,
    BattleCompletedPayload,
    PlayerJoinedPayload,
    PlayerReadyPayload,
    SkillEffectPayload,
    SkillUsedPayload,
    BattleTimeUpdatedPayload,
} from '@/types/socket';

interface OpponentProgress {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
}

export function useBattle(battleId: string) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const { isSubmitting, isRunning, usedSkills, activeEffects } = useAppSelector(
        (state) => state.battle,
    );
    const [opponentProgress, setOpponentProgress] =
        useState<OpponentProgress | null>(null);
    const [lastSubmissionResult, setLastSubmissionResult] =
        useState<SubmissionResult | null>(null);
    const [runResult, setRunResult] = useState<SubmissionResult | null>(null);

    const { data: battle } = useQuery<BattleResponse>({
        queryKey: queryKeys.battle(battleId),
        queryFn: () => battlesApi.getBattle(battleId),
        enabled: !!battleId,
    });

    const problemId = battle?.problemId ?? '';
    const { data: problem } = useQuery<ProblemResponse>({
        queryKey: queryKeys.problem(problemId),
        queryFn: () => battlesApi.getProblem(problemId),
        enabled: !!problemId,
    });

    useEffect(() => {
        const socket = getSocket();
        if (socket) {
            socket.emit('battle.join', { battleId }, (response: { success: boolean; error?: string }) => {
                if (!response.success) {
                    console.error('Failed to join battle room:', response.error);
                }
            });
        }

        return () => {
            if (socket) {
                socket.emit('battle.leave', { battleId });
            }
            dispatch(resetBattle());
            setOpponentProgress(null);
            setLastSubmissionResult(null);
            setRunResult(null);
        };
    }, [battleId, dispatch]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const setBattleData = (
            updater: (current: BattleResponse) => BattleResponse,
        ) => {
            queryClient.setQueryData<BattleResponse>(
                queryKeys.battle(battleId),
                (current) => (current ? updater(current) : current),
            );
        };

        const handleStarted = (data: BattleStartedPayload) => {
            setBattleData((current) => ({
                ...current,
                status: data.status,
                startedAt: data.startedAt,
                problemId: current.problemId ?? data.problem.id,
            }));
            if (data.problem) {
                queryClient.setQueryData(
                    queryKeys.problem(data.problem.id),
                    data.problem as ProblemResponse,
                );
            }
        };

        const handleSubmission = (data: BattleSubmissionPayload) => {
            // Only track opponent's submissions.
            if (data.userId !== userId) {
                setOpponentProgress({
                    userId: data.userId,
                    username: data.username,
                    testsPassed: data.testsPassed,
                    totalTests: data.totalTests,
                });
            }
        };

        const handleCompleted = (data: BattleCompletedPayload) => {
            setBattleData((current) => ({
                ...current,
                status: 'COMPLETED',
                winnerId: data.winnerId,
                endedAt: data.endedAt,
                participants: current.participants.map((p) => {
                    const updated = data.participants.find((dp) => dp.userId === p.userId);
                    return updated
                        ? {
                              ...p,
                              testsPassed: updated.testsPassed,
                              totalTests: updated.totalTests,
                              mmrChange: updated.mmrChange,
                          }
                        : p;
                }),
            }));
            if (userId) {
                void queryClient.invalidateQueries({
                    queryKey: queryKeys.userStats(userId),
                });
                void queryClient.invalidateQueries({
                    queryKey: queryKeys.matchHistory(userId),
                });
            }
            navigate(`/battle/${battleId}/results`);
        };

        const handlePlayerJoined = (data: PlayerJoinedPayload) => {
            setBattleData((current) => {
                const exists = current.participants.some((p) => p.userId === data.userId);
                if (exists) return current;
                return {
                    ...current,
                    participants: [
                        ...current.participants,
                        {
                            id: data.userId,
                            userId: data.userId,
                            username: data.username,
                            testsPassed: 0,
                            totalTests: 0,
                            pointsEarned: 0,
                            isReady: false,
                        },
                    ],
                };
            });
        };

        const handlePlayerReady = (data: PlayerReadyPayload) => {
            setBattleData((current) => ({
                ...current,
                participants: current.participants.map((p) =>
                    p.userId === data.userId ? { ...p, isReady: data.isReady } : p,
                ),
            }));
        };

        const handleSkillEffect = (data: SkillEffectPayload) => {
            // Instant skills (duration = 0) still get a brief visual flash.
            const durationSec = data.duration > 0 ? data.duration : 3;
            const expiresAt = Date.now() + durationSec * 1000;
            dispatch(addActiveEffect({ skillType: data.skillType, expiresAt }));
            setTimeout(() => {
                dispatch(removeActiveEffect(data.skillType));
            }, durationSec * 1000);
        };

        const handleSkillUsed = (data: SkillUsedPayload) => {
            if (data.userId === userId) {
                dispatch(addUsedSkill(data.skillType));
            }
        };

        const handleTimeUpdated = (data: BattleTimeUpdatedPayload) => {
            setBattleData((current) => ({ ...current, startedAt: data.startedAt }));
        };

        socket.on('battle.started', handleStarted);
        socket.on('battle.submission', handleSubmission);
        socket.on('battle.completed', handleCompleted);
        socket.on('battle.player_joined', handlePlayerJoined);
        socket.on('battle.player_ready', handlePlayerReady);
        socket.on('skill.effect', handleSkillEffect);
        socket.on('skill.used', handleSkillUsed);
        socket.on('battle.time_updated', handleTimeUpdated);

        return () => {
            socket.off('battle.started', handleStarted);
            socket.off('battle.submission', handleSubmission);
            socket.off('battle.completed', handleCompleted);
            socket.off('battle.player_joined', handlePlayerJoined);
            socket.off('battle.player_ready', handlePlayerReady);
            socket.off('skill.effect', handleSkillEffect);
            socket.off('skill.used', handleSkillUsed);
            socket.off('battle.time_updated', handleTimeUpdated);
        };
    }, [battleId, dispatch, navigate, queryClient, userId]);

    const submitCode = useCallback(
        async (code: string, language: string) => {
            dispatch(setIsSubmitting(true));
            try {
                const result = await battlesApi.submitCode(battleId, { code, language });
                setLastSubmissionResult(result);
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
                setRunResult(result);
                return result;
            } finally {
                dispatch(setIsRunning(false));
            }
        },
        [problem, dispatch],
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

    const completeBattleManually = useCallback(async () => {
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
        battle,
        problem,
        opponentProgress,
        lastSubmissionResult,
        runResult,
        isSubmitting,
        isRunning,
        usedSkills,
        activeEffects,
        submitCode,
        runCode,
        useSkill,
        completeBattle: completeBattleManually,
        readyUp,
        unready,
    };
}
