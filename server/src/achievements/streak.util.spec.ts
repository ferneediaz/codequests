import { computeStreak } from './streak.util';

describe('computeStreak', () => {
    it('returns null type and zero count for empty input', () => {
        expect(computeStreak([])).toEqual({ type: null, count: 0 });
    });

    it('counts a 5-win streak ending at the most recent loss', () => {
        expect(computeStreak(['W', 'W', 'W', 'W', 'W', 'L'])).toEqual({
            type: 'W',
            count: 5,
        });
    });

    it('reports a 1-loss streak when the last result was a loss', () => {
        expect(computeStreak(['L', 'W', 'W'])).toEqual({ type: 'L', count: 1 });
    });

    it('breaks at the first different outcome', () => {
        expect(computeStreak(['W', 'W', 'D', 'W', 'W'])).toEqual({
            type: 'W',
            count: 2,
        });
    });

    it('counts a pure draw run', () => {
        expect(computeStreak(['D', 'D', 'D'])).toEqual({ type: 'D', count: 3 });
    });

    it('counts a single-result history', () => {
        expect(computeStreak(['W'])).toEqual({ type: 'W', count: 1 });
    });
});
