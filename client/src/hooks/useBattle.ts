import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
    setBattle,
    setProblem,
    setOpponentProgress,
    setSubmissionResult,
    setIsSubmitting,
    completeBattle,
    resetBattle,
} from '@/store/slices/battleSlice';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import type { BattleResponse, ProblemResponse } from '@/types/api';
import type {
    BattleStartedPayload,
    BattleSubmissionPayload,
    BattleCompletedPayload,
    PlayerJoinedPayload,
    PlayerReadyPayload,
} from '@/types/socket';

export function useBattle(battleId: string) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const { battle, problem, opponentProgress, lastSubmissionResult, isSubmitting } =
        useAppSelector((state) => state.battle);

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

        return () => {
            socket.off('battle.started', handleStarted);
            socket.off('battle.submission', handleSubmission);
            socket.off('battle.completed', handleCompleted);
            socket.off('battle.player_joined', handlePlayerJoined);
            socket.off('battle.player_ready', handlePlayerReady);
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
        isSubmitting,
        submitCode,
        completeBattle: completeBattleManually,
        readyUp,
        unready,
    };
}
