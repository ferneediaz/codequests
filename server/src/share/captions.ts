/**
 * Roast caption pool for share images.
 *
 * Tone: gaming banter only. Username-targeted, MMR-targeted, and
 * language-targeted jokes are fine. Identity-based jokes (race / gender
 * / etc.) are never OK and must not appear here.
 *
 * `tier`:
 *  - `mild`   — used when the MMR gap is small or the loser likely has
 *               higher MMR (i.e. the win is "expected" — keep it gentle).
 *  - `spicy`  — used when the winner had a lower MMR than the loser
 *               (upset). Bigger gap = more spice unlocked.
 *
 * Placeholders:
 *  - {winner}   — winner username
 *  - {loser}    — loser username
 *  - {mmrDelta} — winner's MMR change (positive integer, no sign)
 *  - {seconds}  — winner's submission time in seconds (when known)
 */

export interface RoastCaption {
    tier: 'mild' | 'spicy';
    text: string;
}

export const ROAST_CAPTIONS: RoastCaption[] = [
    // mild — banter, not bullying
    { tier: 'mild', text: '{winner} cooked. {loser} got cooked.' },
    { tier: 'mild', text: 'GG {loser}. {winner} +{mmrDelta} MMR.' },
    { tier: 'mild', text: '{loser} took the L like a champ. {winner} took it like a thief.' },
    { tier: 'mild', text: '{winner} > {loser}. The compiler agrees.' },
    { tier: 'mild', text: '{loser} read the docs. {winner} wrote them.' },
    { tier: 'mild', text: 'Tests passed for {winner}. Tests passed on {loser}.' },

    // spicy — for upsets and bigger gaps. Still gaming-banter, no real insults.
    { tier: 'spicy', text: 'Skill issue, {loser}. Get gud.' },
    { tier: 'spicy', text: '{loser} is built different. Different from a winner.' },
    { tier: 'spicy', text: 'L + ratio + skill issue + {winner} won + cope' },
    { tier: 'spicy', text: '{loser} folded faster than a junior in standup.' },
    { tier: 'spicy', text: '{loser} got hit with that O(1) defeat.' },
    { tier: 'spicy', text: '{winner} cracked it in {seconds}s. {loser} cracked.' },
    { tier: 'spicy', text: 'imagine losing to a {winner}. couldn’t be {loser}… oh wait.' },
    { tier: 'spicy', text: 'rm -rf {loser}/ego' },
];

export function pickCaption(opts: {
    mmrGap: number; // positive = upset (winner had lower MMR)
    rng?: () => number;
}): RoastCaption {
    const rng = opts.rng ?? Math.random;
    const allowSpicy = opts.mmrGap >= 50; // 50 MMR or more in winner's favor as underdog
    const pool = ROAST_CAPTIONS.filter((c) =>
        allowSpicy ? true : c.tier === 'mild',
    );
    return pool[Math.floor(rng() * pool.length)];
}

export function fillTemplate(
    text: string,
    vars: { winner: string; loser: string; mmrDelta: number; seconds?: number },
): string {
    return text
        .replace(/\{winner\}/g, vars.winner)
        .replace(/\{loser\}/g, vars.loser)
        .replace(/\{mmrDelta\}/g, String(vars.mmrDelta))
        .replace(/\{seconds\}/g, String(vars.seconds ?? 0));
}
