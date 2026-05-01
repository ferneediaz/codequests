import { Newspaper, Skull, Swords, Trophy } from 'lucide-react';
import type { BattleMode, NewsItem, NewsItemSeverity } from '@/types/api';
import { MODE_META, NEWS_TYPE_ICON, SEVERITY_STYLES } from './constants';

export type GithubContributionsQuery = {
    data?: {
        user?: {
            contributionsCollection?: {
                contributionCalendar?: {
                    weeks?: Array<{
                        contributionDays?: Array<{
                            date: string;
                            contributionCount: number;
                        }>;
                    }>;
                };
            };
        };
    };
};

export function getModeMeta(mode: string): { label: string; icon: typeof Swords } {
    return MODE_META[mode as BattleMode] ?? { label: mode || 'Unknown', icon: Swords };
}

export function toLocalDateKey(value: string): string {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getHeatmapBounds(selectedYear: string): { from: Date; to: Date } {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedYear === 'rolling') {
        const from = new Date(today);
        from.setDate(today.getDate() - 364);
        from.setHours(0, 0, 0, 0);
        return { from, to: today };
    }
    const year = Number(selectedYear);
    const from = new Date(year, 0, 1, 0, 0, 0, 0);
    const to = new Date(year, 11, 31, 23, 59, 59, 999);
    return { from, to };
}

export function resolveNewsPresentation(
    item: NewsItem,
    currentUserId: string | undefined,
): { Icon: typeof Swords; style: (typeof SEVERITY_STYLES)[NewsItemSeverity] } {
    if (item.type === 'FRIEND_BATTLE_RESULT' && !item.isDraw && currentUserId) {
        // Viewer was defeated: flip from the API's default "positive" to a
        // negative, defeat-themed row so the feed doesn't celebrate losses.
        if (item.loser?.id === currentUserId) {
            return { Icon: Skull, style: SEVERITY_STYLES.negative };
        }
        // Explicit win styling when viewer or a friend won; the trophy makes
        // the champion framing obvious even if the API severity changes.
        if (item.winner) {
            return { Icon: Trophy, style: SEVERITY_STYLES.positive };
        }
    }

    return {
        Icon: NEWS_TYPE_ICON[item.type] ?? Newspaper,
        style: SEVERITY_STYLES[item.severity],
    };
}

export function formatRelative(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return new Date(iso).toLocaleDateString();
}
