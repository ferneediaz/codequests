import type { MatchHistoryEntry, BattleMode } from '@/types/api';

export type Streak = { type: 'W' | 'L' | 'D' | 'none'; count: number };

/** Outcome of a completed battle for a user (1v1 / BR, or team modes). */
export function getMatchResultForUser(
    m: MatchHistoryEntry,
    userId: string,
): 'W' | 'L' | 'D' | 'pending' {
    if (m.status !== 'COMPLETED') return 'pending';
    if (m.mode === 'GROUP' || m.mode === 'CLAN_VS_CLAN') {
        if (!m.winningTeam) return 'D';
        const me = m.participants?.find((p) => p.userId === userId);
        if (!me?.teamId) return 'D';
        return me.teamId === m.winningTeam ? 'W' : 'L';
    }
    if (!m.winnerId) return 'D';
    return m.winnerId === userId ? 'W' : 'L';
}

export function computeStreak(
    history: MatchHistoryEntry[],
    userId: string,
): Streak {
    if (!history.length) return { type: 'none', count: 0 };
    // History is ordered most-recent first; only completed matches count.
    const results: ('W' | 'L' | 'D')[] = [];
    for (const m of history) {
        if (m.status !== 'COMPLETED') break;
        const r = getMatchResultForUser(m, userId);
        if (r === 'pending') break;
        results.push(r);
    }
    if (results.length === 0) return { type: 'none', count: 0 };
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

export type HeatmapBuildOptions = {
    year?: number;
    githubCommitsByDate?: Record<string, number>;
};

export type HeatmapData = {
    grid: number[][];
    dates: (Date | null)[][];
    breakdown: { battles: number; githubCommits: number; total: number }[][];
    monthLabels: (string | null)[];
    max: number;
    totalGames: number;
    totalGithubCommits: number;
    totalActivity: number;
    periodLabel: string;
};

function toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Build a GitHub-style activity heatmap (weeks x days).
 * Day index follows JS Date.getDay(): 0 = Sun, 6 = Sat.
 */
export function buildHeatmap(
    history: MatchHistoryEntry[],
    options?: HeatmapBuildOptions,
): HeatmapData {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedYear = options?.year;
    const periodStart = selectedYear
        ? new Date(selectedYear, 0, 1)
        : new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
    const periodEnd = selectedYear ? new Date(selectedYear, 11, 31) : new Date(today);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(0, 0, 0, 0);

    // Align to Sunday so each column is a full week, while keeping
    // the right edge anchored to the selected period end date.
    const alignedStart = new Date(periodStart);
    alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

    const dayCount =
        Math.floor((periodEnd.getTime() - alignedStart.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
    const weeks = Math.ceil(dayCount / 7);

    const countsByDate = new Map<string, number>();
    for (const m of history) {
        const dateStr = m.startedAt ?? m.createdAt;
        if (!dateStr) continue;
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        if (d < periodStart || d > periodEnd) continue;
        const key = toDateKey(d);
        countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }
    const githubCountsByDate = new Map<string, number>();
    for (const [dateKey, commitCount] of Object.entries(options?.githubCommitsByDate ?? {})) {
        if (commitCount <= 0) continue;
        const d = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        if (d < periodStart || d > periodEnd) continue;
        githubCountsByDate.set(dateKey, commitCount);
    }

    const grid: number[][] = [];
    const dates: (Date | null)[][] = [];
    const breakdown: { battles: number; githubCommits: number; total: number }[][] = [];
    const monthLabels: (string | null)[] = new Array(weeks).fill(null);
    let max = 0;
    let totalGames = 0;
    let totalGithubCommits = 0;

    for (let week = 0; week < weeks; week++) {
        const col: number[] = [];
        const dateCol: (Date | null)[] = [];
        const breakdownCol: { battles: number; githubCommits: number; total: number }[] = [];
        for (let day = 0; day < 7; day++) {
            const cellDate = new Date(alignedStart);
            cellDate.setDate(alignedStart.getDate() + week * 7 + day);
            const inRange = cellDate >= periodStart && cellDate <= periodEnd;
            if (!inRange) {
                col.push(0);
                dateCol.push(null);
                breakdownCol.push({ battles: 0, githubCommits: 0, total: 0 });
                continue;
            }
            const dateKey = toDateKey(cellDate);
            const battleCount = countsByDate.get(dateKey) ?? 0;
            const githubCommitCount = githubCountsByDate.get(dateKey) ?? 0;
            const total = battleCount + githubCommitCount;
            col.push(total);
            dateCol.push(cellDate);
            breakdownCol.push({
                battles: battleCount,
                githubCommits: githubCommitCount,
                total,
            });
            if (total > max) max = total;
            totalGames += battleCount;
            totalGithubCommits += githubCommitCount;
        }
        grid.push(col);
        dates.push(dateCol);
        breakdown.push(breakdownCol);
    }

    // Show month label at the first visible week where that month appears.
    // This works for both calendar-year mode and rolling 12-month mode.
    let prevMonth: number | null = null;
    let prevYear: number | null = null;
    for (let week = 0; week < dates.length; week++) {
        const firstVisibleDate = dates[week].find((d): d is Date => d !== null) ?? null;
        if (!firstVisibleDate) continue;
        const month = firstVisibleDate.getMonth();
        const year = firstVisibleDate.getFullYear();
        if (month !== prevMonth || year !== prevYear) {
            monthLabels[week] = firstVisibleDate.toLocaleString('default', {
                month: 'short',
            });
            prevMonth = month;
            prevYear = year;
        }
    }

    const periodLabel = selectedYear ? `${selectedYear}` : 'last 12 months';
    const totalActivity = totalGames + totalGithubCommits;
    return {
        grid,
        dates,
        breakdown,
        monthLabels,
        max,
        totalGames,
        totalGithubCommits,
        totalActivity,
        periodLabel,
    };
}
