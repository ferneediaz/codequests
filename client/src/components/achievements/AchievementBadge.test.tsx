import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { Achievement } from '@/types/achievement';
import { AchievementBadge } from './AchievementBadge';

const baseAchievement: Achievement = {
    id: 'first_blood',
    title: 'First Blood',
    description: 'Win your first battle.',
    icon: 'Swords',
    category: 'wins',
    tier: 'bronze',
    sortOrder: 10,
    unlocked: false,
    unlockedAt: null,
};

describe('AchievementBadge', () => {
    it('renders title visibly', () => {
        render(<AchievementBadge achievement={baseAchievement} />);
        // Title appears in the visible label AND inside the (always-rendered)
        // tooltip — assert at least one occurrence is present.
        expect(screen.getAllByText('First Blood').length).toBeGreaterThan(0);
    });

    it('marks locked achievements with data-locked="true" and a "Locked" tooltip line', () => {
        render(<AchievementBadge achievement={baseAchievement} />);
        const node = screen.getByTestId('achievement-badge-first_blood');
        expect(node.getAttribute('data-locked')).toBe('true');
        expect(screen.getByText('Locked')).toBeInTheDocument();
        // The "unlocked" date is NOT in the DOM for a locked badge.
        expect(screen.queryByText(/Unlocked/i)).not.toBeInTheDocument();
    });

    it('marks unlocked achievements with data-locked="false" and shows unlock date', () => {
        const unlocked: Achievement = {
            ...baseAchievement,
            unlocked: true,
            unlockedAt: '2026-05-01T12:00:00Z',
        };
        render(<AchievementBadge achievement={unlocked} />);
        const node = screen.getByTestId('achievement-badge-first_blood');
        expect(node.getAttribute('data-locked')).toBe('false');
        // The tooltip's "Unlocked <date>" line is rendered.
        expect(screen.getByText(/Unlocked/i)).toBeInTheDocument();
        // No "Locked" copy on an unlocked badge.
        expect(screen.queryByText(/^Locked$/)).not.toBeInTheDocument();
    });

    it('renders the description in the tooltip', () => {
        const withDesc: Achievement = {
            ...baseAchievement,
            description: 'Reach 2500 MMR.',
            id: 'mythic',
        };
        render(<AchievementBadge achievement={withDesc} />);
        expect(screen.getByText('Reach 2500 MMR.')).toBeInTheDocument();
    });
});
