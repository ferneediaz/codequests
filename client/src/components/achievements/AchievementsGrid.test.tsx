import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { Achievement } from '@/types/achievement';
import { AchievementsGrid } from './AchievementsGrid';

const make = (
    id: string,
    overrides: Partial<Achievement> = {},
): Achievement => ({
    id,
    title: id,
    description: `${id} description`,
    icon: 'Trophy',
    category: 'wins',
    tier: 'bronze',
    sortOrder: 10,
    unlocked: false,
    unlockedAt: null,
    ...overrides,
});

describe('AchievementsGrid', () => {
    it('renders one badge per achievement', () => {
        const achievements = [
            make('first_blood'),
            make('on_fire'),
            make('speed_demon'),
        ];
        render(<AchievementsGrid achievements={achievements} />);
        expect(
            screen.getByTestId('achievement-badge-first_blood'),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId('achievement-badge-on_fire'),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId('achievement-badge-speed_demon'),
        ).toBeInTheDocument();
    });

    it('counts unlocked vs total accurately', () => {
        const achievements = [
            make('a', { unlocked: true, unlockedAt: '2026-05-01T00:00:00Z' }),
            make('b', { unlocked: true, unlockedAt: '2026-05-02T00:00:00Z' }),
            make('c'),
        ];
        render(<AchievementsGrid achievements={achievements} />);
        expect(screen.getByTestId('achievements-counter')).toHaveTextContent(
            '2 / 3 unlocked',
        );
    });

    it('reports 0 / N when nothing is unlocked', () => {
        const achievements = [make('a'), make('b')];
        render(<AchievementsGrid achievements={achievements} />);
        expect(screen.getByTestId('achievements-counter')).toHaveTextContent(
            '0 / 2 unlocked',
        );
    });

    it('shows skeletons (NOT badges) while loading', () => {
        render(
            <AchievementsGrid
                achievements={[make('a'), make('b')]}
                isLoading
            />,
        );
        expect(
            screen.getByTestId('achievements-grid-loading'),
        ).toBeInTheDocument();
        // No real badges should render in loading state.
        expect(screen.queryByTestId('achievement-badge-a')).toBeNull();
        expect(screen.queryByTestId('achievement-badge-b')).toBeNull();
        // Counter is not shown during loading either.
        expect(screen.queryByTestId('achievements-counter')).toBeNull();
    });

    it('renders an empty-state message when there are no achievements', () => {
        render(<AchievementsGrid achievements={[]} />);
        expect(screen.getByText('No achievements yet.')).toBeInTheDocument();
    });
});
