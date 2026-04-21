import type { MatchHistoryEntry, BattleMode } from '@/types/api';

export type Streak = { type: 'W' | 'L' | 'D' | 'none'; count: number };

export function computeStreak(
    history: MatchHistoryEntry[],
    userId: string,
): Streak {
    if (!history.length) return { type: 'none', count: 0 };
    // History is ordered most-recent first.
    const results = history.map((m) => {
        if (!m.winnerId) return 'D' as const;
        return m.winnerId === userId ? ('W' as const) : ('L' as const);
    });
    const first = results[0];
    let count = 0;
    for (const r of results) {
        if (r === first) count++;
        else break;
    }
    return { type: first, count };
}

export function computeWinRate(wins: number, losses: number): number {
    const total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
}

export function computeFavoriteLanguage(
    history: MatchHistoryEntry[],
    userId: string,
): { language: string; count: number } | null {
    const counts = new Map<string, number>();
    for (const m of history) {
        const me = m.participants?.find((p) => p.userId === userId);
        if (me?.language) {
            counts.set(me.language, (counts.get(me.language) ?? 0) + 1);
        }
    }
    if (counts.size === 0) return null;
    let best: [string, number] | null = null;
    for (const entry of counts) {
        if (!best || entry[1] > best[1]) best = entry;
    }
    return best ? { language: best[0], count: best[1] } : null;
}

export function computeModeDistribution(
    history: MatchHistoryEntry[],
): Record<BattleMode, number> {
    const counts: Record<BattleMode, number> = {
        ONE_V_ONE: 0,
        BATTLE_ROYALE: 0,
        GROUP: 0,
        CLAN_VS_CLAN: 0,
    };
    for (const m of history) counts[m.mode] = (counts[m.mode] ?? 0) + 1;
    return counts;
}

export function computeAverageTestsPassed(
    history: MatchHistoryEntry[],
    userId: string,
): number {
    let ratios: number[] = [];
    for (const m of history) {
        const me = m.participants?.find((p) => p.userId === userId);
        if (me && me.totalTests > 0) {
            ratios.push(me.testsPassed / me.totalTests);
        }
    }
    if (!ratios.length) return 0;
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return Math.round(avg * 100);
}

/**
 * Build a 12-week activity grid (most recent week on the right).
 * Returns a 2D array [week][dayOfWeek] of counts, where dayOfWeek 0 = Sun.
 */
export function buildHeatmap(
    history: MatchHistoryEntry[],
    weeks = 12,
): { grid: number[][]; max: number; totalGames: number } {
    const days = weeks * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Anchor so that the rightmost column contains today.
    // dayIndex: 0 = oldest day, days - 1 = today.
    const counts = new Array<number>(days).fill(0);

    for (const m of history) {
        const dateStr = m.startedAt ?? m.createdAt;
        if (!dateStr) continue;
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
            (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays < 0 || diffDays >= days) continue;
        const idx = days - 1 - diffDays;
        counts[idx]++;
    }

    // Group into weeks of 7, starting from the anchor column.
    // Column 0 = oldest week, last column = current week.
    const grid: number[][] = [];
    for (let w = 0; w < weeks; w++) {
        const col: number[] = [];
        for (let dow = 0; dow < 7; dow++) {
            col.push(counts[w * 7 + dow] ?? 0);
        }
        grid.push(col);
    }

    const max = counts.reduce((m, v) => (v > m ? v : m), 0);
    const totalGames = counts.reduce((a, b) => a + b, 0);
    return { grid, max, totalGames };
}
