import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { useAppDispatch } from '@/store/hooks';
import {
    addActiveEffect,
    addUsedSkill,
    removeActiveEffect,
    resetBattle,
} from '@/store/slices/battleSlice';
import { getSocket } from '@/services/socket';
import type { BattleResponse, ProblemResponse, SkillType } from '@/types/api';
import type {
    BattleCompletedPayload,
    BattleStartedPayload,
    BattleSubmissionPayload,
    BattleTimeUpdatedPayload,
    PlayerJoinedPayload,
    PlayerReadyPayload,
    SkillEffectPayload,
    SkillUsedPayload,
} from '@/types/socket';

const SKILL_TOAST_LABELS: Record<SkillType, { emoji: string; label: string }> = {
    FREEZE: { emoji: '❄️', label: 'Freeze' },
    SCRAMBLE: { emoji: '🔀', label: 'Scramble' },
    BLIND: { emoji: '🙈', label: 'Blind' },
    TIME_STEAL: { emoji: '⏱️', label: 'Time Steal' },
    FOG_OF_WAR: { emoji: '🌫️', label: 'Fog of War' },
};

export interface OpponentProgress {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
}

export function useBattleSocket(battleId: string, userId: string | undefined) {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [opponentProgress, setOpponentProgress] =
        useState<OpponentProgress | null>(null);

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
                problemId: current.problemId ?? data.problem?.id,
            }));
            if (data.problem) {
                queryClient.setQueryData(
                    queryKeys.problem(data.problem.id),
                    data.problem as ProblemResponse,
                );
            }
        };

        const handleSubmission = (data: BattleSubmissionPayload) => {
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
            const durationSec = data.duration > 0 ? data.duration : 3;
            const expiresAt = Date.now() + durationSec * 1000;
            dispatch(addActiveEffect({ skillType: data.skillType, expiresAt }));
            setTimeout(() => {
                dispatch(removeActiveEffect(data.skillType));
            }, durationSec * 1000);

            // Surface a toast naming the actor + skill so the target user
            // knows what just hit them. Look up actor's username from the
            // cached battle participants.
            const battle = queryClient.getQueryData<BattleResponse>(
                queryKeys.battle(battleId),
            );
            const actor = battle?.participants.find(
                (p) => p.userId === data.fromUserId,
            );
            const cfg = SKILL_TOAST_LABELS[data.skillType];
            if (actor?.user?.username && cfg) {
                toast(
                    `${cfg.emoji} ${actor.user.username} used ${cfg.label} on you!`,
                    { id: `skill-effect-${data.skillType}` },
                );
            }
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

    return { opponentProgress };
}
