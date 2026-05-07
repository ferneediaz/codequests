import {
    reduceBattleRoyaleState,
    sortBattleRoyaleStandings,
    type BattleRoyaleState,
} from './useBattleRoyale';
import type { BattleRoyaleStandingsEntry } from '@/types/api';

const baseState: BattleRoyaleState = {
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

function standing(
    userId: string,
    overrides: Partial<BattleRoyaleStandingsEntry> = {},
): BattleRoyaleStandingsEntry {
    return {
        userId,
        username: userId,
        isEliminated: false,
        placement: null,
        eliminatedInRound: null,
        cumulativePoints: 0,
        roundPoints: 0,
        testsPassed: 0,
        totalTests: 5,
        lastSubmittedAt: null,
        ...overrides,
    };
}

describe('sortBattleRoyaleStandings', () => {
    it('sorts same-problem standings by tests passed then earlier submit time', () => {
        const sorted = sortBattleRoyaleStandings(
            [
                standing('late', {
                    testsPassed: 4,
                    lastSubmittedAt: '2026-05-06T10:01:00.000Z',
                }),
                standing('early', {
                    testsPassed: 4,
                    lastSubmittedAt: '2026-05-06T10:00:00.000Z',
                }),
                standing('behind', { testsPassed: 2 }),
            ],
            'SAME_PROBLEM',
        );

        expect(sorted.map((entry) => entry.userId)).toEqual([
            'early',
            'late',
            'behind',
        ]);
    });

    it('sorts score-attack standings by cumulative points then round points', () => {
        const sorted = sortBattleRoyaleStandings(
            [
                standing('round-lead', { cumulativePoints: 10, roundPoints: 8 }),
                standing('overall-lead', { cumulativePoints: 12, roundPoints: 1 }),
                standing('round-behind', { cumulativePoints: 10, roundPoints: 4 }),
            ],
            'SCORE_ATTACK',
        );

        expect(sorted.map((entry) => entry.userId)).toEqual([
            'overall-lead',
            'round-lead',
            'round-behind',
        ]);
    });

    it('falls through to a stable username tiebreak when nobody has submitted yet', () => {
        // Regression: Infinity - Infinity returned NaN from the comparator,
        // which produced a non-deterministic order in V8.
        const sorted = sortBattleRoyaleStandings(
            [
                standing('zoe', { testsPassed: 0, lastSubmittedAt: null }),
                standing('alice', { testsPassed: 0, lastSubmittedAt: null }),
                standing('bob', { testsPassed: 0, lastSubmittedAt: null }),
            ],
            'SAME_PROBLEM',
        );

        expect(sorted.map((entry) => entry.userId)).toEqual([
            'alice',
            'bob',
            'zoe',
        ]);
    });

    it('ranks players who have submitted above those who have not', () => {
        const sorted = sortBattleRoyaleStandings(
            [
                standing('idle', { testsPassed: 0, lastSubmittedAt: null }),
                standing('submitted', {
                    testsPassed: 0,
                    lastSubmittedAt: '2026-05-06T10:00:00.000Z',
                }),
            ],
            'SAME_PROBLEM',
        );

        expect(sorted[0].userId).toBe('submitted');
    });
});

describe('reduceBattleRoyaleState', () => {
    it('applies round_start payloads', () => {
        const state = reduceBattleRoyaleState(baseState, {
            type: 'round_start',
            payload: {
                battleId: 'battle-1',
                roundNumber: 2,
                totalRounds: 3,
                problemId: 'problem-2',
                timeLimitSeconds: 180,
                eliminateCount: 2,
                remainingUserIds: ['a', 'b', 'c'],
                startedAt: '2026-05-06T10:00:00.000Z',
            },
        });

        expect(state.currentRound).toBe(2);
        expect(state.roundProblemId).toBe('problem-2');
        expect(state.remainingUserIds).toEqual(['a', 'b', 'c']);
    });

    it('marks eliminated users from elimination payloads', () => {
        const state = reduceBattleRoyaleState(
            { ...baseState, standings: [standing('a'), standing('b')] },
            {
                type: 'elimination',
                payload: {
                    battleId: 'battle-1',
                    userId: 'b',
                    roundNumber: 1,
                    placement: 4,
                },
            },
        );

        expect(state.standings.find((entry) => entry.userId === 'b')).toMatchObject({
            isEliminated: true,
            placement: 4,
            eliminatedInRound: 1,
        });
    });
});
