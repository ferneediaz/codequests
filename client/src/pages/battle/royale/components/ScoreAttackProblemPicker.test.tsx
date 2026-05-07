import { fireEvent, render, screen } from '@testing-library/react';
import { ScoreAttackProblemPicker } from './ScoreAttackProblemPicker';
import type { ProblemPoolItem } from '@/types/api';

const problems: ProblemPoolItem[] = [
    {
        id: 'pool-1',
        problemId: 'two-sum',
        title: 'Two Sum',
        difficulty: 'EASY',
        pointValue: 2,
    },
    {
        id: 'pool-2',
        problemId: 'valid-parentheses',
        title: 'Valid Parentheses',
        difficulty: 'MEDIUM',
        pointValue: 5,
    },
];

describe('ScoreAttackProblemPicker', () => {
    it('switches active problems and marks solved submissions', () => {
        const onSelect = vi.fn();
        render(
            <ScoreAttackProblemPicker
                problems={problems}
                activeProblemId="two-sum"
                submissions={[
                    {
                        userId: 'me',
                        problemId: 'two-sum',
                        testsPassed: 3,
                        totalTests: 3,
                        allPassed: true,
                    },
                ]}
                currentUserId="me"
                onSelect={onSelect}
            />,
        );

        expect(screen.getByText('Solved')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Valid Parentheses'));

        expect(onSelect).toHaveBeenCalledWith('valid-parentheses');
    });
});
