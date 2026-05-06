import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { battlesApi } from '@/services/battles';
import type { BattleResponse, ProblemResponse } from '@/types/api';

export function useBattleData(battleId: string) {
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

    return { battle, problem };
}
