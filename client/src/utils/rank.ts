import type { RankTier } from '@/types/api';

const RANK_TIERS: RankTier[] = [
    { name: 'Bug', icon: '🐛', color: '#22c55e', minMmr: 0, maxMmr: 799 },
    { name: 'Intern', icon: '📎', color: '#9ca3af', minMmr: 800, maxMmr: 999 },
    { name: 'Copy Paster', icon: '📋', color: '#cd7f32', minMmr: 1000, maxMmr: 1199 },
    { name: 'Stack Overflow Andy', icon: '🔍', color: '#c0c0c0', minMmr: 1200, maxMmr: 1399 },
    { name: 'Code Monkey', icon: '🐒', color: '#ffd700', minMmr: 1400, maxMmr: 1599 },
    { name: '10x Dev', icon: '⚡', color: '#3b82f6', minMmr: 1600, maxMmr: 1899 },
    { name: 'Cracked', icon: '💀', color: '#ef4444', minMmr: 1900, maxMmr: null },
];

export function getRankTiers(): RankTier[] {
    return RANK_TIERS;
}

export function getRankTier(mmr: number): RankTier {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (mmr >= RANK_TIERS[i].minMmr) {
            return RANK_TIERS[i];
        }
    }
    return RANK_TIERS[0];
}

export function getNextRankTier(mmr: number): RankTier | null {
    const current = getRankTier(mmr);
    const idx = RANK_TIERS.findIndex((t) => t.name === current.name);
    if (idx === -1 || idx === RANK_TIERS.length - 1) return null;
    return RANK_TIERS[idx + 1];
}

/** MMR still needed to reach the next rank’s **minimum** (same as nextTier.minMmr − mmr, floored at 0). */
export function getMmrToNextRankFloor(mmr: number): { next: RankTier; points: number } | null {
    const next = getNextRankTier(mmr);
    if (!next) return null;
    return { next, points: Math.max(0, next.minMmr - Number(mmr)) };
}

/**
 * 0–100% progress from this rank's MMR floor to the next rank's MMR floor
 * (e.g. Copy Paster 1000 → Stack Overflow 1200). At exactly the current floor
 * this is 0% — that is not a data bug. Top tier: 100%.
 */
export function getRankProgress(mmr: number): number {
    const m = Number(mmr);
    if (!Number.isFinite(m)) return 0;
    const current = getRankTier(m);
    if (current.maxMmr == null) return 100;
    const next = getNextRankTier(m);
    if (!next) return 100;
    const span = next.minMmr - current.minMmr;
    if (span <= 0) return 100;
    const into = m - current.minMmr;
    return Math.max(0, Math.min(100, Math.floor((into / span) * 100)));
}
