export type StreakOutcome = 'W' | 'L' | 'D';

export interface StreakResult {
    type: StreakOutcome | null;
    count: number;
}

/**
 * Counts the leading run of identical outcomes.
 * `outcomes` must be ordered most-recent-first.
 */
export function computeStreak(outcomes: StreakOutcome[]): StreakResult {
    if (outcomes.length === 0) return { type: null, count: 0 };
    const head = outcomes[0];
    let count = 0;
    for (const o of outcomes) {
        if (o === head) count++;
        else break;
    }
    return { type: head, count };
}
