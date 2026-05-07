import { act, render, screen } from '@testing-library/react';
import { RoundEndOverlay } from './RoundEndOverlay';
import type { BattleParticipant } from '@/types/api';

const participants: BattleParticipant[] = [
    {
        id: 'p1',
        userId: 'u1',
        username: 'Ada',
        testsPassed: 0,
        totalTests: 0,
        pointsEarned: 0,
        isReady: true,
    },
];

describe('RoundEndOverlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows eliminated players and completes after the countdown', () => {
        const onDone = vi.fn();
        render(
            <RoundEndOverlay
                roundEnd={{
                    battleId: 'battle-1',
                    roundNumber: 1,
                    endedReason: 'TIMER',
                    eliminatedUserIds: ['u1'],
                    standings: [],
                }}
                participants={participants}
                onDone={onDone}
            />,
        );

        expect(screen.getByText('1 player eliminated')).toBeInTheDocument();
        expect(screen.getByText('Ada')).toBeInTheDocument();
        expect(screen.getByText(/Next round starts in 3s/)).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(onDone).toHaveBeenCalledTimes(1);
    });
});
