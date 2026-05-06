import { useAppSelector } from '@/store/hooks';
import { useBattleActions } from './useBattleActions';
import { useBattleData } from './useBattleData';
import { useBattleSocket } from './useBattleSocket';

export function useBattle(battleId: string) {
    const userId = useAppSelector((state) => state.auth.user?.id);
    const { battle, problem } = useBattleData(battleId);
    const { opponentProgress } = useBattleSocket(battleId, userId);
    const actions = useBattleActions(battleId, problem, userId);

    return {
        battle,
        problem,
        opponentProgress,
        ...actions,
    };
}
