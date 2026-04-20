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

export function getRankTier(mmr: number): RankTier {
    for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
        if (mmr >= RANK_TIERS[i].minMmr) {
            return RANK_TIERS[i];
        }
    }
    return RANK_TIERS[0];
}
