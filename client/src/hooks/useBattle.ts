import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
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
    completeBattle,
    setBattleStartedAt,
    resetBattle,
} from '@/store/slices/battleSlice';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import type { BattleResponse, ProblemResponse, SkillType } from '@/types/api';
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

export function useBattle(battleId: string) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const {
        battle,
        problem,
        opponentProgress,
        lastSubmissionResult,
        runResult,
        isSubmitting,
        isRunning,
        usedSkills,
        activeEffects,
    } = useAppSelector((state) => state.battle);

    // Fetch battle data and join room
    useEffect(() => {
        let mounted = true;

        async function loadBattle() {
            try {
                const { data } = await api.get<BattleResponse>(`/battles/${battleId}`);
                if (!mounted) return;
                dispatch(setBattle(data));

                // Load problem if battle has a problemId
                if (data.problemId) {
                    const { data: problemData } = await api.get<ProblemResponse>(
                        `/problems/${data.problemId}`,
                    );
                    if (mounted) dispatch(setProblem(problemData));
                }
            } catch (error) {
                console.error('Failed to load battle:', error);
            }
        }

        loadBattle();

        // Join battle room via WebSocket
        const socket = getSocket();
        if (socket) {
            socket.emit('battle.join', { battleId }, (response: { success: boolean; error?: string }) => {
                if (!response.success) {
                    console.error('Failed to join battle room:', response.error);
                }
            });
        }

        return () => {
            mounted = false;
            if (socket) {
                socket.emit('battle.leave', { battleId });
            }
            dispatch(resetBattle());
        };
    }, [battleId, dispatch]);

    // Listen for WebSocket events
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const handleStarted = (data: BattleStartedPayload) => {
            dispatch(setBattle({
                ...battle!,
                status: data.status,
                startedAt: data.startedAt,
            }));
            if (data.problem) {
                dispatch(setProblem(data.problem as ProblemResponse));
            }
        };

        const handleSubmission = (data: BattleSubmissionPayload) => {
            // Only track opponent's submissions
            if (data.userId !== userId) {
                dispatch(setOpponentProgress({
                    userId: data.userId,
                    username: data.username,
                    testsPassed: data.testsPassed,
                    totalTests: data.totalTests,
                }));
            }
        };

        const handleCompleted = (data: BattleCompletedPayload) => {
            dispatch(completeBattle({
                ...battle!,
                status: 'COMPLETED',
                winnerId: data.winnerId,
                endedAt: data.endedAt,
                participants: battle?.participants.map((p) => {
                    const updated = data.participants.find((dp) => dp.userId === p.userId);
                    return updated
                        ? { ...p, testsPassed: updated.testsPassed, totalTests: updated.totalTests, mmrChange: updated.mmrChange }
                        : p;
                }) ?? [],
            }));
            navigate(`/battle/${battleId}/results`);
        };

        socket.on('battle.started', handleStarted);
        socket.on('battle.submission', handleSubmission);
        socket.on('battle.completed', handleCompleted);

        const handlePlayerJoined = (data: PlayerJoinedPayload) => {
            if (!battle) return;
            // Add new participant if not already present
            const exists = battle.participants.some((p) => p.userId === data.userId);
            if (!exists) {
                dispatch(setBattle({
                    ...battle,
                    participants: [
                        ...battle.participants,
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
                }));
            }
        };

        const handlePlayerReady = (data: PlayerReadyPayload) => {
            if (!battle) return;
            dispatch(setBattle({
                ...battle,
                participants: battle.participants.map((p) =>
                    p.userId === data.userId ? { ...p, isReady: data.isReady } : p,
                ),
            }));
        };

        socket.on('battle.player_joined', handlePlayerJoined);
        socket.on('battle.player_ready', handlePlayerReady);

        const handleSkillEffect = (data: SkillEffectPayload) => {
            // Instant skills (duration = 0) still get a brief visual flash
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
            dispatch(setBattleStartedAt(data.startedAt));
        };

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
    }, [battle, battleId, userId, dispatch, navigate]);

    const submitCode = useCallback(
        async (code: string, language: string) => {
            dispatch(setIsSubmitting(true));
            try {
                const { data } = await api.post(`/battles/${battleId}/submit`, { code, language });
                dispatch(setSubmissionResult(data));
                return data;
            } catch (error) {
                dispatch(setIsSubmitting(false));
                throw error;
            }
        },
        [battleId, dispatch],
    );

    const runCode = useCallback(
        async (code: string, language: string) => {
            if (!problem) return;
            dispatch(setIsRunning(true));
            try {
                const { data } = await api.post(`/problems/${problem.id}/execute`, {
                    code,
                    language,
                });
                dispatch(setRunResult(data));
                return data;
            } catch (error) {
                dispatch(setIsRunning(false));
                throw error;
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
            await api.post(`/battles/${battleId}/complete`);
        } catch (error) {
            console.error('Failed to complete battle:', error);
        }
    }, [battleId]);

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
