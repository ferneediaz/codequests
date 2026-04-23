export interface RankTier {
  name: string;
  icon: string;
  color: string;
  minMmr: number;
  maxMmr: number | null;
}

const RANK_TIERS: RankTier[] = [
  { name: 'Cracked', icon: '💀', color: '#ef4444', minMmr: 1900, maxMmr: null },
  { name: '10x Dev', icon: '⚡', color: '#3b82f6', minMmr: 1600, maxMmr: 1899 },
  { name: 'Code Monkey', icon: '🐒', color: '#ffd700', minMmr: 1400, maxMmr: 1599 },
  { name: 'Stack Overflow Andy', icon: '🔍', color: '#c0c0c0', minMmr: 1200, maxMmr: 1399 },
  { name: 'Copy Paster', icon: '📋', color: '#cd7f32', minMmr: 1000, maxMmr: 1199 },
  { name: 'Intern', icon: '📎', color: '#9ca3af', minMmr: 800, maxMmr: 999 },
  { name: 'Bug', icon: '🐛', color: '#22c55e', minMmr: -Infinity, maxMmr: 799 },
];

export function getRankTier(mmr: number): RankTier {
  for (const tier of RANK_TIERS) {
    if (mmr >= tier.minMmr) {
      return tier;
    }
  }
  return RANK_TIERS[RANK_TIERS.length - 1];
}

/**
 * Clan rank tier — reuses the same thresholds as user tiers so a clan's
 * "rating" visibly maps onto the same leaderboard rungs.
 */
export function getClanRankTier(clanMmr: number): RankTier {
  return getRankTier(clanMmr);
}
