import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AchievementUnlockedPayload } from '@/types/socket';

type Handler = (data: AchievementUnlockedPayload) => void;

interface FakeSocket {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    emit: (data: AchievementUnlockedPayload) => void;
}

const fakeSocket: FakeSocket = (() => {
    const handlers = new Set<Handler>();
    return {
        on: vi.fn((event: string, handler: Handler) => {
            if (event === 'achievement.unlocked') handlers.add(handler);
        }),
        off: vi.fn((event: string, handler: Handler) => {
            if (event === 'achievement.unlocked') handlers.delete(handler);
        }),
        emit: (data) => {
            for (const h of handlers) h(data);
        },
    };
})();

vi.mock('@/services/socket', () => ({
    getSocket: () => fakeSocket,
}));

const burstSpy = vi.fn();

vi.mock('./confettiBursts', () => ({
    burstFromCorners: () => burstSpy(),
    prefersReducedMotion: () => false,
}));

vi.mock('./AchievementUnlockPopup', () => ({
    AchievementUnlockPopup: ({
        achievement,
        queueRemaining,
        onDismiss,
    }: {
        achievement: AchievementUnlockedPayload;
        queueRemaining: number;
        onDismiss: () => void;
    }) => (
        <div data-testid="popup-stub" data-id={achievement.achievementId}>
            <span data-testid="popup-title">{achievement.title}</span>
            <span data-testid="popup-remaining">{queueRemaining}</span>
            <button onClick={onDismiss}>dismiss</button>
        </div>
    ),
}));

import { AchievementUnlockOverlay } from './AchievementUnlockOverlay';

const make = (
    overrides: Partial<AchievementUnlockedPayload> = {},
): AchievementUnlockedPayload => ({
    userId: 'me',
    achievementId: 'first_blood',
    title: 'First Blood',
    description: 'Win your first battle.',
    icon: 'Swords',
    tier: 'bronze',
    unlockedAt: '2026-05-07T10:00:00Z',
    battleId: 'battle-1',
    ...overrides,
});

describe('AchievementUnlockOverlay', () => {
    beforeEach(() => {
        burstSpy.mockClear();
        fakeSocket.on.mockClear();
        fakeSocket.off.mockClear();
    });

    afterEach(() => {
        // Clear any leftover handlers between tests so emits don't leak.
        // (The fake's `off` removes them, but unmount in act handles it; this
        // is a belt-and-braces guard.)
    });

    it('renders nothing while the queue is empty', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        expect(screen.queryByTestId('popup-stub')).toBeNull();
    });

    it('shows the head of the queue when an unlock arrives', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            fakeSocket.emit(make());
        });
        expect(screen.getByTestId('popup-title')).toHaveTextContent(
            'First Blood',
        );
        expect(screen.getByTestId('popup-remaining')).toHaveTextContent('0');
    });

    it('queues multiple unlocks in arrival order', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            fakeSocket.emit(make({ achievementId: 'first_blood', title: 'First Blood' }));
            fakeSocket.emit(make({ achievementId: 'speed_demon', title: 'Speed Demon' }));
        });
        expect(screen.getByTestId('popup-stub')).toHaveAttribute(
            'data-id',
            'first_blood',
        );
        expect(screen.getByTestId('popup-remaining')).toHaveTextContent('1');

        // Dismiss the head — the next unlock should surface.
        act(() => {
            screen.getByText('dismiss').click();
        });
        expect(screen.getByTestId('popup-stub')).toHaveAttribute(
            'data-id',
            'speed_demon',
        );
        expect(screen.getByTestId('popup-remaining')).toHaveTextContent('0');
    });

    it('ignores unlocks for a different battle', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            fakeSocket.emit(make({ battleId: 'battle-2' }));
        });
        expect(screen.queryByTestId('popup-stub')).toBeNull();
    });

    it('ignores unlocks with no battleId (non-battle context)', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            const { battleId: _battleId, ...rest } = make();
            void _battleId;
            fakeSocket.emit(rest as AchievementUnlockedPayload);
        });
        expect(screen.queryByTestId('popup-stub')).toBeNull();
    });

    it('fires confetti exactly once for the first unlock of the battle', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            fakeSocket.emit(
                make({ achievementId: 'first_blood', title: 'First Blood' }),
            );
            fakeSocket.emit(
                make({ achievementId: 'speed_demon', title: 'Speed Demon' }),
            );
        });
        expect(burstSpy).toHaveBeenCalledTimes(1);
    });

    it('deduplicates repeat events for the same achievement', () => {
        render(<AchievementUnlockOverlay battleId="battle-1" />);
        act(() => {
            fakeSocket.emit(make());
            fakeSocket.emit(make());
        });
        expect(screen.getByTestId('popup-remaining')).toHaveTextContent('0');
    });
});
