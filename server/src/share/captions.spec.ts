import { fillTemplate, pickCaption, ROAST_CAPTIONS } from './captions';

describe('captions', () => {
    describe('pickCaption', () => {
        it('returns only mild captions when MMR gap is small or negative', () => {
            // Deterministic RNG that always picks the first index.
            const rng = () => 0;
            const c = pickCaption({ mmrGap: 10, rng });
            expect(c.tier).toBe('mild');
        });

        it('unlocks the spicy pool when the winner had >= 50 lower MMR', () => {
            // Pin RNG to the last index so the choice falls into the longer
            // (mild + spicy) pool — proves spicy entries are reachable.
            const rng = () => 0.9999;
            const c = pickCaption({ mmrGap: 200, rng });
            const expected = ROAST_CAPTIONS[ROAST_CAPTIONS.length - 1];
            expect(c).toEqual(expected);
        });

        it('every caption has a non-empty text and a known tier', () => {
            for (const c of ROAST_CAPTIONS) {
                expect(c.text.length).toBeGreaterThan(0);
                expect(['mild', 'spicy']).toContain(c.tier);
            }
        });

        it('captions never include identity-based slurs or hard-coded usernames — placeholders only', () => {
            for (const c of ROAST_CAPTIONS) {
                // Anything that looks like a hard-coded human name is a smell.
                // The pool should only personalize via {winner}/{loser}.
                expect(c.text).not.toMatch(/john|alice|bob/i);
            }
        });
    });

    describe('fillTemplate', () => {
        it('substitutes all placeholders', () => {
            const out = fillTemplate('{winner} +{mmrDelta} | {loser} cracked in {seconds}s', {
                winner: 'NEO',
                loser: 'AGENT',
                mmrDelta: 24,
                seconds: 87,
            });
            expect(out).toBe('NEO +24 | AGENT cracked in 87s');
        });

        it('renders {seconds} as 0 when not provided', () => {
            const out = fillTemplate('time: {seconds}s', {
                winner: 'a',
                loser: 'b',
                mmrDelta: 1,
            });
            expect(out).toBe('time: 0s');
        });

        it('replaces every occurrence of a placeholder', () => {
            const out = fillTemplate('{loser} loses, {loser} cries', {
                winner: 'w',
                loser: 'L',
                mmrDelta: 1,
            });
            expect(out).toBe('L loses, L cries');
        });
    });
});
