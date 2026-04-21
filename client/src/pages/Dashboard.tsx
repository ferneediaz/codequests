import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    Swords,
    Trophy,
    TrendingDown,
    Flame,
    Percent,
    Zap,
    Users,
    Crown,
    Activity,
    Code2,
    ChevronRight,
    Target,
    ArrowRight,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
} from 'lucide-react';
import api from '@/services/api';
import type {
    UserStats,
    MatchHistoryEntry,
    BattleMode,
} from '@/types/api';
import { getRankTier, getNextRankTier, getRankProgress } from '@/utils/rank';
import {
    computeStreak,
    computeWinRate,
    computeFavoriteLanguage,
    computeModeDistribution,
    computeAverageTestsPassed,
    buildHeatmap,
} from '@/utils/stats';

const MODE_META: Record<BattleMode, { label: string; icon: typeof Swords }> = {
    ONE_V_ONE: { label: '1v1', icon: Swords },
    BATTLE_ROYALE: { label: 'Royale', icon: Crown },
    GROUP: { label: 'Group', icon: Users },
    CLAN_VS_CLAN: { label: 'Clan', icon: Users },
};

export default function Dashboard() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const [showAllMatches, setShowAllMatches] = useState(false);

    const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
        queryKey: ['userStats', user?.id],
        queryFn: async () => {
            const { data } = await api.get(`/users/${user!.id}/stats`);
            return data;
        },
        enabled: !!user?.id,
    });

    const { data: history, isLoading: historyLoading } = useQuery<MatchHistoryEntry[]>({
        queryKey: ['matchHistory', user?.id, 20],
        queryFn: async () => {
            const { data } = await api.get(`/users/${user!.id}/history`, {
                params: { limit: 20 },
            });
            return data;
        },
        enabled: !!user?.id,
    });

    const mmr = stats?.mmr ?? user?.mmr ?? 1000;
    const wins = stats?.wins ?? user?.wins ?? 0;
    const losses = stats?.losses ?? user?.losses ?? 0;

    const tier = getRankTier(mmr);
    const nextTier = getNextRankTier(mmr);
    const progress = getRankProgress(mmr);

    const derived = useMemo(() => {
        const h = history ?? [];
        const uid = user?.id ?? '';
        return {
            streak: computeStreak(h, uid),
            winRate: computeWinRate(wins, losses),
            favLang: computeFavoriteLanguage(h, uid),
            modeDist: computeModeDistribution(h),
            avgTests: computeAverageTestsPassed(h, uid),
            heatmap: buildHeatmap(h, 12),
        };
    }, [history, user?.id, wins, losses]);

    const visibleMatches = showAllMatches ? history ?? [] : (history ?? []).slice(0, 5);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-6xl px-4 py-8 space-y-8">
                {/* ---------------- HERO ---------------- */}
                <AnimateIn direction="up">
                    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-violet-500/10 p-8 backdrop-blur-sm">
                        <div
                            className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full blur-3xl opacity-40"
                            style={{ background: tier.color }}
                        />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-5">
                                <div
                                    className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-background/60 text-4xl shadow-lg"
                                    style={{ boxShadow: `0 0 30px ${tier.color}25` }}
                                >
                                    {tier.icon}
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Welcome back,</p>
                                    <h1 className="text-3xl font-extrabold tracking-tight">
                                        {user?.username ?? 'Player'}
                                    </h1>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold"
                                            style={{
                                                color: tier.color,
                                                borderColor: `${tier.color}40`,
                                                background: `${tier.color}15`,
                                            }}
                                        >
                                            {tier.icon} {tier.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground font-mono">
                                            {mmr} MMR
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:items-center">
                                <Button
                                    size="lg"
                                    className="h-14 px-8 text-base"
                                    onClick={() => navigate('/play')}
                                >
                                    <Swords className="mr-2 h-5 w-5" />
                                    Play
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="h-14 px-6"
                                    onClick={() =>
                                        navigate('/matchmaking', {
                                            state: {
                                                config: {
                                                    mode: 'ONE_V_ONE',
                                                    timeLimitMinutes: 10,
                                                    enabledSkills: [],
                                                },
                                            },
                                        })
                                    }
                                >
                                    <Zap className="mr-2 h-4 w-4 text-primary" />
                                    Quick Match
                                </Button>
                            </div>
                        </div>

                        {/* Rank progress */}
                        <div className="relative mt-8">
                            <div className="mb-2 flex items-end justify-between text-xs">
                                <span className="text-muted-foreground">
                                    Progress to{' '}
                                    <span className="font-semibold text-foreground">
                                        {nextTier ? `${nextTier.icon} ${nextTier.name}` : 'Top Tier'}
                                    </span>
                                </span>
                                <span className="font-mono text-muted-foreground">
                                    {nextTier ? `${mmr} / ${nextTier.minMmr}` : 'MAX'}
                                </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/60 bg-background/60">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary via-blue-400 to-violet-400 transition-all duration-700"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </AnimateIn>

                {/* ---------------- STAT TILES ---------------- */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        delay={0}
                        label="Wins"
                        value={wins}
                        icon={<Trophy className="h-5 w-5" />}
                        accent="text-green-500"
                        accentBg="bg-green-500/10"
                        loading={statsLoading}
                    />
                    <StatTile
                        delay={75}
                        label="Losses"
                        value={losses}
                        icon={<TrendingDown className="h-5 w-5" />}
                        accent="text-red-500"
                        accentBg="bg-red-500/10"
                        loading={statsLoading}
                    />
                    <StatTile
                        delay={150}
                        label="Win Rate"
                        value={`${derived.winRate}%`}
                        icon={<Percent className="h-5 w-5" />}
                        accent="text-primary"
                        accentBg="bg-primary/10"
                        loading={statsLoading}
                        footer={
                            wins + losses > 0
                                ? `${wins + losses} games played`
                                : 'No games yet'
                        }
                    />
                    <StatTile
                        delay={225}
                        label={
                            derived.streak.type === 'W'
                                ? 'Win Streak'
                                : derived.streak.type === 'L'
                                    ? 'Loss Streak'
                                    : 'Streak'
                        }
                        value={
                            derived.streak.count > 0 &&
                                (derived.streak.type === 'W' || derived.streak.type === 'L')
                                ? `${derived.streak.count}${derived.streak.type}`
                                : '—'
                        }
                        icon={<Flame className="h-5 w-5" />}
                        accent={
                            derived.streak.type === 'W'
                                ? 'text-orange-400'
                                : derived.streak.type === 'L'
                                    ? 'text-red-500'
                                    : 'text-muted-foreground'
                        }
                        accentBg={
                            derived.streak.type === 'W'
                                ? 'bg-orange-400/10'
                                : derived.streak.type === 'L'
                                    ? 'bg-red-500/10'
                                    : 'bg-muted/40'
                        }
                        loading={historyLoading}
                    />
                </div>

                {/* ---------------- HEATMAP + BREAKDOWN ---------------- */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <AnimateIn className="lg:col-span-2" delay={0}>
                        <Card className="h-full">
                            <CardContent className="p-6">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" />
                                        <h2 className="text-base font-semibold">Activity</h2>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {derived.heatmap.totalGames} games · last 12 weeks
                                    </span>
                                </div>
                                {historyLoading ? (
                                    <Skeleton className="h-[120px] w-full" />
                                ) : (
                                    <Heatmap
                                        grid={derived.heatmap.grid}
                                        max={derived.heatmap.max}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </AnimateIn>

                    <AnimateIn delay={150}>
                        <Card className="h-full">
                            <CardContent className="space-y-5 p-6">
                                <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-primary" />
                                    <h2 className="text-base font-semibold">Play Breakdown</h2>
                                </div>

                                <ModeBreakdown dist={derived.modeDist} />

                                <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-2">
                                    <div>
                                        <p className="mb-1 text-xs text-muted-foreground">
                                            Favorite Lang
                                        </p>
                                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                                            <Code2 className="h-3.5 w-3.5 text-primary" />
                                            {derived.favLang?.language ?? '—'}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs text-muted-foreground">
                                            Avg Tests
                                        </p>
                                        <div className="text-sm font-semibold">
                                            {derived.avgTests}%
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </AnimateIn>
                </div>

                {/* ---------------- RECENT MATCHES ---------------- */}
                <AnimateIn>
                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-base font-semibold">Recent Matches</h2>
                                {(history?.length ?? 0) > 5 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowAllMatches((v) => !v)}
                                    >
                                        {showAllMatches
                                            ? 'Show less'
                                            : `Show all (${history?.length})`}
                                    </Button>
                                )}
                            </div>

                            {historyLoading ? (
                                <div className="space-y-2">
                                    {[...Array(4)].map((_, i) => (
                                        <Skeleton key={i} className="h-14 w-full" />
                                    ))}
                                </div>
                            ) : !history?.length ? (
                                <div className="py-10 text-center">
                                    <Swords className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                    <p className="text-muted-foreground">
                                        No matches yet. Start your first battle!
                                    </p>
                                    <Button className="mt-4" onClick={() => navigate('/play')}>
                                        Find Match
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {visibleMatches.map((match) => (
                                        <MatchRow
                                            key={match.id}
                                            match={match}
                                            userId={user?.id ?? ''}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </AnimateIn>

                {/* ---------------- QUICK ACTIONS ---------------- */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <QuickAction
                        delay={0}
                        title="New Battle"
                        description="Configure mode, skills & time"
                        icon={<Swords className="h-5 w-5" />}
                        onClick={() => navigate('/play')}
                    />
                    <QuickAction
                        delay={100}
                        title="Quick Match"
                        description="Jump into 1v1 ranked instantly"
                        icon={<Zap className="h-5 w-5" />}
                        onClick={() =>
                            navigate('/matchmaking', {
                                state: {
                                    config: {
                                        mode: 'ONE_V_ONE',
                                        timeLimitMinutes: 10,
                                        enabledSkills: [],
                                    },
                                },
                            })
                        }
                    />
                    <QuickAction
                        delay={200}
                        title="Invite Friends"
                        description="Create a private game with a code"
                        icon={<Users className="h-5 w-5" />}
                        onClick={() => navigate('/play')}
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="group relative flex flex-col gap-6 overflow-hidden rounded-xl border bg-card py-6 text-card-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
            {children}
        </div>
    );
}

function StatTile({
    label,
    value,
    icon,
    accent,
    accentBg,
    loading,
    footer,
    delay = 0,
}: {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    accent: string;
    accentBg: string;
    loading?: boolean;
    footer?: string;
    delay?: number;
}) {
    return (
        <AnimateIn delay={delay} direction="up">
            <StatCard>
                <div className="flex items-start justify-between px-5">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                        </p>
                        {loading ? (
                            <Skeleton className="mt-2 h-8 w-16" />
                        ) : (
                            <p className="mt-1 text-3xl font-extrabold tracking-tight">
                                {value}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground min-h-[1rem]">
                            {footer || '\u00A0'}
                        </p>
                    </div>
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentBg} ${accent} transition-transform group-hover:scale-110`}
                    >
                        {icon}
                    </div>
                </div>
            </StatCard>
        </AnimateIn>
    );
}

function Heatmap({ grid, max }: { grid: number[][]; max: number }) {
    const intensity = (count: number) => {
        if (count === 0 || max === 0) return 'bg-muted/40';
        const ratio = count / max;
        if (ratio > 0.75) return 'bg-primary';
        if (ratio > 0.5) return 'bg-primary/75';
        if (ratio > 0.25) return 'bg-primary/50';
        return 'bg-primary/25';
    };

    const dayLabels = ['Mon', 'Wed', 'Fri'];

    return (
        <div className="flex gap-3">
            <div className="flex flex-col justify-between py-0.5 text-[10px] text-muted-foreground">
                {dayLabels.map((d) => (
                    <span key={d}>{d}</span>
                ))}
            </div>
            <div className="flex flex-1 gap-1 overflow-x-auto">
                {grid.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                        {week.map((count, di) => (
                            <div
                                key={di}
                                className={`h-3.5 w-3.5 rounded-sm transition-colors ${intensity(count)}`}
                                title={
                                    count === 0
                                        ? 'No games'
                                        : `${count} game${count === 1 ? '' : 's'}`
                                }
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex flex-col justify-end gap-1 text-[10px] text-muted-foreground">
                <span>Less</span>
                <div className="flex gap-0.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary/75" />
                    <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                </div>
                <span>More</span>
            </div>
        </div>
    );
}

function ModeBreakdown({ dist }: { dist: Record<BattleMode, number> }) {
    const entries = (Object.keys(dist) as BattleMode[])
        .map((mode) => ({ mode, count: dist[mode] }))
        .filter((e) => e.count > 0)
        .sort((a, b) => b.count - a.count);
    const total = entries.reduce((a, b) => a + b.count, 0);

    if (total === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Play a match to see your mode breakdown.
            </p>
        );
    }

    return (
        <div className="space-y-2.5">
            {entries.map(({ mode, count }) => {
                const pct = Math.round((count / total) * 100);
                const meta = MODE_META[mode];
                const Icon = meta.icon;
                return (
                    <div key={mode}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {meta.label}
                            </span>
                            <span className="font-mono text-muted-foreground">
                                {count} · {pct}%
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                            <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function MatchRow({
    match,
    userId,
}: {
    match: MatchHistoryEntry;
    userId: string;
}) {
    const participants = match.participants ?? [];
    const me = participants.find((p) => p.userId === userId);
    const opponent = participants.find((p) => p.userId !== userId);
    const won = match.winnerId === userId;
    const isDraw = match.status === 'COMPLETED' && !match.winnerId;
    const mmrChange = me?.mmrChange;
    const meta = MODE_META[match.mode];
    const ModeIcon = meta.icon;
    const when = match.endedAt ?? match.startedAt ?? match.createdAt;
    const whenLabel = when ? formatRelative(when) : '';

    return (
        <div className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/60">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${isDraw
                        ? 'bg-muted text-muted-foreground'
                        : won
                            ? 'bg-green-500/15 text-green-500'
                            : 'bg-red-500/15 text-red-500'
                        }`}
                >
                    {isDraw ? 'D' : won ? 'W' : 'L'}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                        <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] uppercase"
                        >
                            <ModeIcon className="h-3 w-3" />
                            {meta.label}
                        </Badge>
                        <span className="truncate font-medium">
                            vs {opponent?.username ?? 'Unknown'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {whenLabel}
                        {me && me.totalTests > 0 && (
                            <>
                                {' · '}
                                {me.testsPassed}/{me.totalTests} tests
                            </>
                        )}
                        {me?.language && <> · {me.language}</>}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {mmrChange != null && (
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold ${mmrChange > 0
                            ? 'bg-green-500/10 text-green-500'
                            : mmrChange < 0
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        {mmrChange > 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                        ) : mmrChange < 0 ? (
                            <ArrowDownRight className="h-3 w-3" />
                        ) : (
                            <Minus className="h-3 w-3" />
                        )}
                        {mmrChange > 0 ? '+' : ''}
                        {mmrChange}
                    </span>
                )}
            </div>
        </div>
    );
}

function QuickAction({
    title,
    description,
    icon,
    onClick,
    delay = 0,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    delay?: number;
}) {
    return (
        <AnimateIn delay={delay} direction="up">
            <button
                onClick={onClick}
                className="group relative flex w-full items-center gap-4 rounded-2xl border border-border bg-card/50 p-5 text-left transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5"
            >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </button>
        </AnimateIn>
    );
}

function formatRelative(iso: string): string {
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
