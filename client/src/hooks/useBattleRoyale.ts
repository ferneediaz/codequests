import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { battlesApi } from '@/services/battles';
import { getSocket } from '@/services/socket';
import type {
    BattleResponse,
    BattleRoyaleEliminationPayload,
    BattleRoyaleFormat,
    BattleRoyaleRoundEndPayload,
    BattleRoyaleRoundStartPayload,
    BattleRoyaleStandingsEntry,
    BattleRoyaleStandingsPayload,
    BattleRoundResponse,
    ProblemPoolItem,
} from '@/types/api';

export interface BattleRoyaleState {
    currentRound: number;
    totalRounds: number;
    roundProblemId: string | null;
    roundStartedAt: string | null;
    roundTimeLimitSeconds: number;
    eliminateCount: number;
    remainingUserIds: string[];
    standings: BattleRoyaleStandingsEntry[];
    lastRoundEnd: BattleRoyaleRoundEndPayload | null;
    lastElimination: BattleRoyaleEliminationPayload | null;
}

type BattleRoyaleAction =
    | {
          type: 'seed';
          rounds: BattleRoundResponse[];
          standings: BattleRoyaleStandingsEntry[];
          currentRound: number;
      }
    | { type: 'round_start'; payload: BattleRoyaleRoundStartPayload }
    | { type: 'standings'; payload: BattleRoyaleStandingsPayload }
    | { type: 'round_end'; payload: BattleRoyaleRoundEndPayload }
    | { type: 'elimination'; payload: BattleRoyaleEliminationPayload };

const initialState: BattleRoyaleState = {
    currentRound: 0,
    totalRounds: 0,
    roundProblemId: null,
    roundStartedAt: null,
    roundTimeLimitSeconds: 0,
    eliminateCount: 0,
    remainingUserIds: [],
    standings: [],
    lastRoundEnd: null,
    lastElimination: null,
};

export function sortBattleRoyaleStandings(
    standings: BattleRoyaleStandingsEntry[],
    format: BattleRoyaleFormat,
) {
    return [...standings].sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) {
            return a.isEliminated ? 1 : -1;
        }

        if (format === 'SCORE_ATTACK') {
            const cumulativeDiff = b.cumulativePoints - a.cumulativePoints;
            if (cumulativeDiff !== 0) return cumulativeDiff;

            const roundDiff = b.roundPoints - a.roundPoints;
            if (roundDiff !== 0) return roundDiff;
        } else {
            const testsDiff = b.testsPassed - a.testsPassed;
            if (testsDiff !== 0) return testsDiff;
        }

        // Players who have not submitted yet sort below those who have. When
        // both sides are missing a submission, fall through to the stable
        // username tiebreaker — never return `Infinity - Infinity = NaN`.
        if (a.lastSubmittedAt && b.lastSubmittedAt) {
            const diff =
                new Date(a.lastSubmittedAt).getTime() -
                new Date(b.lastSubmittedAt).getTime();
            if (diff !== 0) return diff;
        } else if (!!a.lastSubmittedAt !== !!b.lastSubmittedAt) {
            return a.lastSubmittedAt ? -1 : 1;
        }

        return (a.username ?? a.userId).localeCompare(b.username ?? b.userId);
    });
}

export function reduceBattleRoyaleState(
    state: BattleRoyaleState,
    action: BattleRoyaleAction,
): BattleRoyaleState {
    switch (action.type) {
        case 'seed': {
            const activeRound =
                action.rounds.find((round) => round.roundNumber === action.currentRound) ??
                action.rounds.find((round) => round.status === 'IN_PROGRESS') ??
                action.rounds[0];

            return {
                ...state,
                currentRound: action.currentRound || activeRound?.roundNumber || 0,
                totalRounds: action.rounds.length,
                roundProblemId: activeRound?.problemId ?? null,
                roundStartedAt: activeRound?.startedAt ?? null,
                roundTimeLimitSeconds: activeRound?.timeLimitSeconds ?? 0,
                eliminateCount: activeRound?.eliminateCount ?? 0,
                standings: action.standings,
            };
        }
        case 'round_start':
            return {
                ...state,
                currentRound: action.payload.roundNumber,
                totalRounds: action.payload.totalRounds,
                roundProblemId: action.payload.problemId,
                roundStartedAt: action.payload.startedAt,
                roundTimeLimitSeconds: action.payload.timeLimitSeconds,
                eliminateCount: action.payload.eliminateCount,
                remainingUserIds: action.payload.remainingUserIds,
                lastRoundEnd: null,
            };
        case 'standings':
            return {
                ...state,
                currentRound: action.payload.roundNumber,
                standings: action.payload.standings,
            };
        case 'round_end':
            return {
                ...state,
                lastRoundEnd: action.payload,
                standings: action.payload.standings,
            };
        case 'elimination':
            return {
                ...state,
                lastElimination: action.payload,
                standings: state.standings.map((entry) =>
                    entry.userId === action.payload.userId
                        ? {
                              ...entry,
                              isEliminated: true,
                              placement: action.payload.placement,
                              eliminatedInRound: action.payload.roundNumber,
                          }
                        : entry,
                ),
            };
        default:
            return state;
    }
}

function getProblemPoolItems(battle: BattleResponse | undefined): ProblemPoolItem[] {
    const pool = battle?.problemPool;
    if (!pool) return [];
    if (Array.isArray(pool)) return pool;
    return pool.items ?? [];
}

export function useBattleRoyale(
    battleId: string,
    battle: BattleResponse | undefined,
    userId: string | undefined,
) {
    const queryClient = useQueryClient();
    const [state, dispatch] = useReducer(reduceBattleRoyaleState, initialState);
    // We seed local state from REST exactly once on first hydration. After
    // that, all updates flow through WebSocket events. Without this guard,
    // every WS event invalidates the rounds/standings queries, the refetch
    // re-fires this effect, and the seed reducer overwrites the just-pushed
    // WS state with stale derived data (e.g. between rounds, when no round
    // is `IN_PROGRESS`, the seed falls back to `rounds[0]`, the completed
    // round 1, snapping the UI back).
    const hasSeededRef = useRef(false);

    const { data: rounds = [] } = useQuery({
        queryKey: queryKeys.battleRounds(battleId),
        queryFn: () => battlesApi.listRounds(battleId),
        enabled: !!battleId && battle?.mode === 'BATTLE_ROYALE',
    });

    const { data: standingsResponse } = useQuery({
        queryKey: queryKeys.battleStandings(battleId),
        queryFn: () => battlesApi.getStandings(battleId),
        enabled: !!battleId && battle?.mode === 'BATTLE_ROYALE',
    });

    useEffect(() => {
        if (hasSeededRef.current) return;
        if (!rounds.length || !standingsResponse) return;
        hasSeededRef.current = true;
        dispatch({
            type: 'seed',
            rounds,
            standings: standingsResponse.standings,
            currentRound: standingsResponse.currentRound || battle?.currentRound || 0,
        });
    }, [battle?.currentRound, rounds, standingsResponse]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const invalidateRoundQueries = () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.battleRounds(battleId),
            });
            void queryClient.invalidateQueries({
                queryKey: queryKeys.battleStandings(battleId),
            });
        };

        const handleRoundStart = (payload: BattleRoyaleRoundStartPayload) => {
            if (payload.battleId !== battleId) return;
            dispatch({ type: 'round_start', payload });
            if (payload.problemId) {
                void queryClient.prefetchQuery({
                    queryKey: queryKeys.problem(payload.problemId),
                    queryFn: () => battlesApi.getProblem(payload.problemId!),
                });
            }
            invalidateRoundQueries();
        };

        const handleStandings = (payload: BattleRoyaleStandingsPayload) => {
            if (payload.battleId !== battleId) return;
            dispatch({ type: 'standings', payload });
            queryClient.setQueryData(queryKeys.battleStandings(battleId), {
                battleId,
                currentRound: payload.roundNumber,
                standings: payload.standings,
            });
        };

        const handleRoundEnd = (payload: BattleRoyaleRoundEndPayload) => {
            if (payload.battleId !== battleId) return;
            dispatch({ type: 'round_end', payload });
            invalidateRoundQueries();
        };

        const handleElimination = (payload: BattleRoyaleEliminationPayload) => {
            if (payload.battleId !== battleId) return;
            dispatch({ type: 'elimination', payload });
            if (payload.userId === userId) {
                toast.warning(`You were eliminated in round ${payload.roundNumber}.`, {
                    description: 'You can keep watching the remaining players.',
                });
            }
        };

        socket.on('battle.round_start', handleRoundStart);
        socket.on('battle.royale_standings', handleStandings);
        socket.on('battle.round_end', handleRoundEnd);
        socket.on('battle.elimination', handleElimination);

        return () => {
            socket.off('battle.round_start', handleRoundStart);
            socket.off('battle.royale_standings', handleStandings);
            socket.off('battle.round_end', handleRoundEnd);
            socket.off('battle.elimination', handleElimination);
        };
    }, [battleId, queryClient, userId]);

    const format = battle?.battleRoyaleFormat ?? 'SAME_PROBLEM';
    const sortedStandings = useMemo(
        () => sortBattleRoyaleStandings(state.standings, format),
        [format, state.standings],
    );
    const problemPoolItems = useMemo(() => getProblemPoolItems(battle), [battle]);
    const me = userId
        ? sortedStandings.find((entry) => entry.userId === userId)
        : undefined;
    const remainingUserIds =
        state.remainingUserIds.length > 0
            ? state.remainingUserIds
            : sortedStandings
                  .filter((entry) => !entry.isEliminated)
                  .map((entry) => entry.userId);

    return {
        ...state,
        standings: sortedStandings,
        rounds,
        problemPoolItems,
        currentRoundDetails: rounds.find(
            (round) => round.roundNumber === state.currentRound,
        ),
        isEliminated: me?.isEliminated ?? false,
        isFinalRound: state.totalRounds > 0 && state.currentRound === state.totalRounds,
        remainingUserIds,
        remainingCount: remainingUserIds.length,
    };
}
