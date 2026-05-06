import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    Activity,
    ArrowRight,
    BookOpen,
    Code2,
    Flame,
    Newspaper,
    Percent,
    Swords,
    Target,
    TrendingDown,
    Trophy,
    Users,
    Zap,
} from 'lucide-react';
import type {
    UserStats,
    MatchHistoryEntry,
    NewsResponse,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { usersApi } from '@/services/users';
import { getRankTier, getRankProgress, getRankTiers, getMmrToNextRankFloor } from '@/utils/rank';
import {
    computeStreak,
    computeWinRate,
    computeFavoriteLanguage,
    computeModeDistribution,
    computeAverageTestsPassed,
    buildHeatmap,
} from '@/utils/stats';
import { usePaywall } from '@/hooks/usePaywall';
import { supabase } from '@/services/supabase';
import { HARD_CODED_NEWS_PREVIEW } from './constants';
import {
    type GithubContributionsQuery,
    getHeatmapBounds,
    toLocalDateKey,
} from './utils';
import { Heatmap } from './components/Heatmap';
import { MatchRow } from './components/MatchRow';
import { ModeBreakdown } from './components/ModeBreakdown';
import { NewsRow } from './components/NewsRow';
import { QuickAction } from './components/QuickAction';
import { StatTile } from './components/StatTile';

export default function Dashboard() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const userId = user?.id ?? '';
    const [showAllMatches, setShowAllMatches] = useState(false);
    const [heatmapYear, setHeatmapYear] = useState<string>('rolling');
    const { requireCanPlay } = usePaywall();

    const handleQuickMatch = () => {
        if (!requireCanPlay()) return;
        navigate('/matchmaking', {
            state: {
                config: {
                    mode: 'ONE_V_ONE',
                    timeLimitMinutes: 10,
                    enabledSkills: [],
                },
            },
        });
    };

    const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
        queryKey: queryKeys.userStats(userId),
        queryFn: () => usersApi.getStats(userId),
        enabled: !!userId,
    });

    const { data: history, isLoading: historyLoading } = useQuery<MatchHistoryEntry[]>({
        queryKey: queryKeys.matchHistory(userId, 20),
        queryFn: () => usersApi.getMatchHistory(userId, { limit: 20 }),
        enabled: !!userId,
    });

    const {
        data: newsPages,
        isLoading: newsLoading,
        fetchNextPage: fetchMoreNews,
        hasNextPage: hasMoreNews,
        isFetchingNextPage: isFetchingMoreNews,
    } = useInfiniteQuery<NewsResponse>({
        queryKey: queryKeys.newsFeed(userId),
        initialPageParam: undefined as string | undefined,
        queryFn: ({ pageParam }) =>
            usersApi.getNews(userId, {
                limit: 15,
                filter: 'all',
                before: pageParam as string | undefined,
            }),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: !!userId,
    });

    const { data: githubActivity } = useQuery<{
        username: string;
        commitsByDate: Record<string, number>;
    } | null>({
        queryKey: queryKeys.githubActivity(userId, heatmapYear),
        queryFn: async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const provider = session?.user?.app_metadata?.provider;
            if (provider !== 'github') return null;
            const githubUsername =
                session?.user?.user_metadata?.user_name ??
                session?.user?.user_metadata?.preferred_username;
            if (!githubUsername) return null;

            const { from, to } = getHeatmapBounds(heatmapYear);
            const commitsByDate: Record<string, number> = {};
            const providerToken = session?.provider_token;

            if (providerToken) {
                const graphqlRes = await fetch('https://api.github.com/graphql', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${providerToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query: `
                            query($login: String!, $from: DateTime!, $to: DateTime!) {
                                user(login: $login) {
                                    contributionsCollection(from: $from, to: $to) {
                                        contributionCalendar {
                                            weeks {
                                                contributionDays {
                                                    date
                                                    contributionCount
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        `,
                        variables: {
                            login: githubUsername,
                            from: from.toISOString(),
                            to: to.toISOString(),
                        },
                    }),
                });

                if (graphqlRes.ok) {
                    const gqlData = (await graphqlRes.json()) as GithubContributionsQuery;
                    const weeks =
                        gqlData.data?.user?.contributionsCollection?.contributionCalendar?.weeks ??
                        [];
                    for (const week of weeks) {
                        for (const day of week.contributionDays ?? []) {
                            commitsByDate[day.date] = day.contributionCount ?? 0;
                        }
                    }
                    return { username: githubUsername, commitsByDate };
                }
            }

            // Fallback for users without provider token (less complete than contribution calendar).
            for (let page = 1; page <= 10; page++) {
                const eventsRes = await fetch(
                    `https://api.github.com/users/${githubUsername}/events/public?per_page=100&page=${page}`,
                    {
                        headers: {
                            Accept: 'application/vnd.github+json',
                        },
                    },
                );
                if (!eventsRes.ok) break;
                const events = (await eventsRes.json()) as Array<{
                    type?: string;
                    created_at?: string;
                    payload?: { size?: number };
                }>;
                if (!events.length) break;
                for (const event of events) {
                    if (event.type !== 'PushEvent' || !event.created_at) continue;
                    const dateKey = toLocalDateKey(event.created_at);
                    const eventDate = new Date(event.created_at);
                    if (eventDate < from || eventDate > to) continue;
                    const commitCount = Math.max(1, event.payload?.size ?? 1);
                    commitsByDate[dateKey] = (commitsByDate[dateKey] ?? 0) + commitCount;
                }
            }

            return { username: githubUsername, commitsByDate };
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10,
    });

    const newsItems = useMemo(() => {
        const apiItems = (newsPages?.pages ?? []).flatMap((p) => p.items);
        return [...HARD_CODED_NEWS_PREVIEW, ...apiItems].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
    }, [newsPages]);

    const availableHeatmapYears = useMemo(() => {
        const years = new Set<number>([new Date().getFullYear()]);
        for (const match of history ?? []) {
            const dateStr = match.startedAt ?? match.createdAt;
            if (!dateStr) continue;
            const year = new Date(dateStr).getFullYear();
            if (!Number.isNaN(year)) years.add(year);
        }
        for (const dateKey of Object.keys(githubActivity?.commitsByDate ?? {})) {
            const year = new Date(`${dateKey}T00:00:00`).getFullYear();
            if (!Number.isNaN(year)) years.add(year);
        }
        return [...years].sort((a, b) => b - a);
    }, [githubActivity?.commitsByDate, history]);

    const mmr = typeof stats?.mmr === 'number' ? stats.mmr : (user?.mmr ?? 1000);
    const wins = stats?.wins ?? user?.wins ?? 0;
    const losses = stats?.losses ?? user?.losses ?? 0;

    const tier = getRankTier(mmr);
    const mmrToNextRank = getMmrToNextRankFloor(mmr);
    const nextTier = mmrToNextRank?.next ?? null;
    const progress = getRankProgress(mmr);
    const rankTiers = getRankTiers();
    const currentRankIndex = rankTiers.findIndex((rank) => rank.name === tier.name);

    const derived = useMemo(() => {
        const h = history ?? [];
        const uid = user?.id ?? '';
        return {
            streak: computeStreak(h, uid),
            winRate: computeWinRate(wins, losses),
            favLang: computeFavoriteLanguage(h, uid),
            modeDist: computeModeDistribution(h),
            avgTests: computeAverageTestsPassed(h, uid),
            heatmap: buildHeatmap(h, {
                year: heatmapYear === 'rolling' ? undefined : Number(heatmapYear),
                githubCommitsByDate: githubActivity?.commitsByDate,
            }),
        };
    }, [githubActivity?.commitsByDate, heatmapYear, history, user?.id, wins, losses]);

    const longestGithubCodingStreak = useMemo(() => {
        let longest = 0;
        let current = 0;
        for (let wi = 0; wi < derived.heatmap.dates.length; wi++) {
            for (let di = 0; di < 7; di++) {
                const date = derived.heatmap.dates[wi]?.[di] ?? null;
                if (!date) continue;
                const commitCount = derived.heatmap.breakdown[wi]?.[di]?.githubCommits ?? 0;
                if (commitCount > 0) {
                    current += 1;
                    if (current > longest) longest = current;
                } else {
                    current = 0;
                }
            }
        }
        return longest;
    }, [derived.heatmap.breakdown, derived.heatmap.dates]);

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
                                    onClick={handleQuickMatch}
                                >
                                    <Zap className="mr-2 h-4 w-4 text-primary" />
                                    Quick Match
                                </Button>
                            </div>
                        </div>

                        {/* Rank progress */}
                        <div className="relative mt-8">
                            <div className="rounded-2xl border border-border/60 bg-background/35 p-4 backdrop-blur-sm">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span
                                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                            style={{
                                                borderColor: `${tier.color}40`,
                                                background: `${tier.color}18`,
                                                color: tier.color,
                                            }}
                                        >
                                            {tier.icon} {tier.name}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                            {nextTier ? (
                                                <>
                                                    Next:{' '}
                                                    <span className="font-semibold text-foreground">
                                                        {nextTier.icon} {nextTier.name}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="font-semibold text-foreground">
                                                    Top tier reached
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <span className="text-xs font-mono text-muted-foreground">
                                        {mmrToNextRank != null
                                            ? `${mmrToNextRank.points} MMR to next rank`
                                            : 'MAX'}
                                    </span>
                                </div>

                                <div
                                    className="mt-3"
                                    title={
                                        nextTier
                                            ? 'Fill is % from the start of this rank to the next rank. It is 0% when you are exactly at the bottom of your current rank, even though your MMR / next-rank MMR can look like a high ratio.'
                                            : undefined
                                    }
                                >
                                    <div className="mb-2 flex items-end justify-between gap-2 text-xs">
                                        <span className="text-muted-foreground">Rank-up progress</span>
                                        {nextTier ? (
                                            <div className="text-right">
                                                <span className="font-mono text-sm font-semibold text-foreground">
                                                    {progress}%
                                                </span>
                                                <div className="text-[11px] font-mono text-muted-foreground">
                                                    {mmr} → {nextTier.minMmr} MMR
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="font-mono text-muted-foreground">MAX</span>
                                        )}
                                    </div>
                                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-border/60 bg-background/60">
                                        <div
                                            className="h-full min-h-px min-w-px rounded-full bg-gradient-to-r from-primary via-blue-400 to-violet-400 transition-all duration-700"
                                            style={{
                                                width: `${!nextTier ? 100 : progress}%`,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className="relative h-8">
                                        <div className="absolute left-0 right-0 top-3 h-[2px] bg-border/70" />
                                        <div
                                            className="absolute left-0 top-3 h-[2px] bg-gradient-to-r from-primary via-blue-400 to-violet-400"
                                            style={{
                                                width:
                                                    currentRankIndex <= 0
                                                        ? '0%'
                                                        : `${(currentRankIndex / (rankTiers.length - 1)) * 100}%`,
                                            }}
                                        />
                                        {rankTiers.map((rank, index) => {
                                            const isCurrent = rank.name === tier.name;
                                            const isNext = !!nextTier && rank.name === nextTier.name;
                                            const isPassed = index <= currentRankIndex;
                                            const mmrLabel =
                                                rank.maxMmr == null
                                                    ? `${rank.minMmr}+`
                                                    : `${rank.minMmr}-${rank.maxMmr}`;
                                            const mmrToRank = Math.max(0, rank.minMmr - mmr);
                                            const hoverInfo = `${rank.icon} ${rank.name}\nMMR: ${mmrLabel}\n${isCurrent
                                                ? 'Current rank'
                                                : isPassed
                                                    ? 'Unlocked'
                                                    : `${mmrToRank} MMR to unlock`
                                                }`;
                                            return (
                                                <div
                                                    key={rank.name}
                                                    className="absolute top-0 -translate-x-1/2"
                                                    style={{
                                                        left: `${(index / (rankTiers.length - 1)) * 100}%`,
                                                    }}
                                                >
                                                    <div
                                                        className="mx-auto h-6 w-6 cursor-pointer rounded-full border text-[12px] shadow-sm"
                                                        style={{
                                                            borderColor:
                                                                isCurrent || isNext || isPassed
                                                                    ? `${rank.color}80`
                                                                    : `${rank.color}35`,
                                                            background:
                                                                isCurrent || isNext || isPassed
                                                                    ? `${rank.color}22`
                                                                    : `${rank.color}10`,
                                                            boxShadow: isCurrent
                                                                ? `0 0 0 2px ${rank.color}35`
                                                                : undefined,
                                                        }}
                                                        title={hoverInfo}
                                                    >
                                                        <span className="flex h-full items-center justify-center">
                                                            {rank.icon}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
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
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {derived.heatmap.totalGames} battles
                                            {derived.heatmap.totalGithubCommits > 0
                                                ? ` · ${derived.heatmap.totalGithubCommits} GH commits`
                                                : ''}
                                            {longestGithubCodingStreak > 0
                                                ? ` · ${longestGithubCodingStreak}d coding streak`
                                                : ''}
                                            {' · '}
                                            {derived.heatmap.periodLabel}
                                        </span>
                                        <select
                                            value={heatmapYear}
                                            onChange={(e) => setHeatmapYear(e.target.value)}
                                            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                                            aria-label="Select activity year"
                                        >
                                            <option value="rolling">Last 12 months</option>
                                            {availableHeatmapYears.map((year) => (
                                                <option key={year} value={String(year)}>
                                                    {year}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {historyLoading ? (
                                    <Skeleton className="h-[120px] w-full" />
                                ) : (
                                    <Heatmap
                                        grid={derived.heatmap.grid}
                                        dates={derived.heatmap.dates}
                                        breakdown={derived.heatmap.breakdown}
                                        monthLabels={derived.heatmap.monthLabels}
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

                {/* ---------------- NEWS ---------------- */}
                <AnimateIn>
                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2">
                                    <Newspaper className="h-4 w-4 text-primary" />
                                    <h2 className="text-base font-semibold">News</h2>
                                </div>
                            </div>

                            {newsLoading ? (
                                <div className="space-y-2">
                                    {[...Array(4)].map((_, i) => (
                                        <Skeleton key={i} className="h-14 w-full" />
                                    ))}
                                </div>
                            ) : !newsItems.length ? (
                                <div className="py-10 text-center">
                                    <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                    <p className="text-muted-foreground">No news yet. Go start some drama.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {newsItems.map((item) => (
                                        <NewsRow
                                            key={item.id}
                                            item={item}
                                            currentUserId={user?.id}
                                        />
                                    ))}
                                    {hasMoreNews && (
                                        <div className="pt-2 text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => fetchMoreNews()}
                                                disabled={isFetchingMoreNews}
                                            >
                                                {isFetchingMoreNews
                                                    ? 'Loading...'
                                                    : 'Show more'}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </AnimateIn>

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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <QuickAction
                        delay={0}
                        title="New Battle"
                        description="Configure mode, skills & time"
                        icon={<Swords className="h-5 w-5" />}
                        onClick={() => navigate('/play')}
                    />
                    <QuickAction
                        delay={75}
                        title="Quick Match"
                        description="Jump into 1v1 ranked instantly"
                        icon={<Zap className="h-5 w-5" />}
                        onClick={handleQuickMatch}
                    />
                    <QuickAction
                        delay={150}
                        title="Practice Ground"
                        description="Solve problems, no timer, no pressure"
                        icon={<BookOpen className="h-5 w-5" />}
                        onClick={() => navigate('/practice')}
                    />
                    <QuickAction
                        delay={225}
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
