import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Code2,
    Percent,
    Target,
    TrendingDown,
    Trophy,
    Users,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { StatTileGrid } from '@/components/layout/StatTileGrid';
import { DataState } from '@/components/layout/DataState';
import { HeatmapCard } from '@/components/heatmap/HeatmapCard';
import { AchievementsGrid } from '@/components/achievements';
import { queryKeys } from '@/lib/queryKeys';
import { usersApi } from '@/services/users';
import { achievementsApi } from '@/services/achievements';
import {
    buildHeatmap,
    computeFavoriteLanguage,
    computeModeDistribution,
    computeWinRate,
} from '@/utils/stats';
import type {
    Achievement,
    GithubActivity,
    MatchHistoryEntry,
    ProblemContribution,
    PublicUser,
} from '@/types/api';
import type { PracticeStats } from '@/types/practice';
import { MatchRow } from '@/pages/dashboard/components/MatchRow';
import { ModeBreakdown } from '@/pages/dashboard/components/ModeBreakdown';
import { StatTile } from '@/pages/dashboard/components/StatTile';
import { ProfileHero } from './components/ProfileHero';
import { ContributionsSection } from './components/ContributionsSection';

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const currentUser = useAppSelector((state) => state.auth.user);

    // Self-view always redirects to Dashboard. Runs before any data
    // fetch so we never spin up a "view someone else" page for yourself.
    if (
        username &&
        currentUser?.username &&
        currentUser.username.toLowerCase() === username.toLowerCase()
    ) {
        return <Navigate to="/dashboard" replace />;
    }

    if (!username) {
        return <Navigate to="/" replace />;
    }

    return <ProfileContent username={username} />;
}

function ProfileContent({ username }: { username: string }) {
    const {
        data: profile,
        isLoading: profileLoading,
        error: profileError,
    } = useQuery<PublicUser>({
        queryKey: queryKeys.userByUsername(username),
        queryFn: () => usersApi.getByUsername(username),
    });

    const profileId = profile?.id;
    const heatmapYear = String(new Date().getFullYear());

    const { data: history, isLoading: historyLoading } = useQuery<
        MatchHistoryEntry[]
    >({
        queryKey: queryKeys.matchHistory(profileId ?? '', 20),
        queryFn: () => usersApi.getMatchHistory(profileId!, { limit: 20 }),
        enabled: !!profileId,
    });

    const { data: githubActivity } = useQuery<GithubActivity>({
        queryKey: queryKeys.githubActivity(profileId ?? '', heatmapYear),
        queryFn: () => usersApi.getGithubActivity(profileId!, heatmapYear),
        enabled: !!profileId,
        staleTime: 1000 * 60 * 10,
    });

    const { data: contributions, isLoading: contributionsLoading } = useQuery<
        ProblemContribution[]
    >({
        queryKey: queryKeys.userContributions(profileId ?? ''),
        queryFn: () => usersApi.getContributions(profileId!),
        enabled: !!profileId,
    });

    const { data: practice } = useQuery<PracticeStats>({
        queryKey: queryKeys.practice.statsForUser(profileId ?? ''),
        queryFn: () => usersApi.getPracticeStatsForUser(profileId!),
        enabled: !!profileId,
    });

    const { data: achievements, isLoading: achievementsLoading } = useQuery<
        Achievement[]
    >({
        queryKey: queryKeys.achievements.forUser(profileId ?? ''),
        queryFn: () => achievementsApi.listForUser(profileId!),
        enabled: !!profileId,
    });

    const derived = useMemo(() => {
        const h = history ?? [];
        const wins = profile?.wins ?? 0;
        const losses = profile?.losses ?? 0;
        return {
            winRate: computeWinRate(wins, losses),
            favLang: computeFavoriteLanguage(h, profile?.id ?? ''),
            modeDist: computeModeDistribution(h),
            heatmap: buildHeatmap(h, {
                year: Number(heatmapYear),
                githubCommitsByDate: githubActivity?.commitsByDate,
            }),
        };
    }, [
        history,
        profile?.wins,
        profile?.losses,
        profile?.id,
        heatmapYear,
        githubActivity?.commitsByDate,
    ]);

    if (profileError) {
        return (
            <div className="relative min-h-[calc(100vh-4rem)]">
                <AmbientBackground variant="default" />
                <div className="relative mx-auto max-w-2xl px-4 py-16 text-center">
                    <h1 className="text-2xl font-bold">Profile not found</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        We couldn't find a player with the username @{username}.
                    </p>
                </div>
            </div>
        );
    }

    if (profileLoading || !profile) {
        return (
            <div className="relative min-h-[calc(100vh-4rem)]">
                <AmbientBackground variant="default" />
                <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8">
                    <Skeleton className="h-48 w-full rounded-3xl" />
                    <div className="grid gap-4 md:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const wins = profile.wins;
    const losses = profile.losses;
    const totalGames = wins + losses;

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-6xl space-y-8 px-4 py-8">
                <ProfileHero user={profile} />

                <StatTileGrid>
                    <StatTile
                        label="MMR"
                        value={profile.mmr}
                        icon={<Trophy className="h-5 w-5" />}
                        accent="text-yellow-500"
                        accentBg="bg-yellow-500/10"
                        delay={0}
                    />
                    <StatTile
                        label="Wins"
                        value={wins}
                        icon={<Target className="h-5 w-5" />}
                        accent="text-green-500"
                        accentBg="bg-green-500/10"
                        delay={50}
                    />
                    <StatTile
                        label="Losses"
                        value={losses}
                        icon={<TrendingDown className="h-5 w-5" />}
                        accent="text-red-500"
                        accentBg="bg-red-500/10"
                        delay={100}
                    />
                    <StatTile
                        label="Win rate"
                        value={`${derived.winRate}%`}
                        footer={
                            totalGames > 0
                                ? `${totalGames} game${totalGames === 1 ? '' : 's'} played`
                                : 'No games yet'
                        }
                        icon={<Percent className="h-5 w-5" />}
                        accent="text-blue-500"
                        accentBg="bg-blue-500/10"
                        delay={150}
                    />
                </StatTileGrid>

                <AnimateIn direction="up" delay={150}>
                    <HeatmapCard
                        data={derived.heatmap}
                        isLoading={historyLoading}
                        githubUsername={githubActivity?.username}
                    />
                </AnimateIn>

                <AnimateIn direction="up" delay={175}>
                    <Card>
                        <CardContent className="p-6">
                            <AchievementsGrid
                                achievements={achievements ?? []}
                                isLoading={achievementsLoading}
                            />
                        </CardContent>
                    </Card>
                </AnimateIn>

                <div className="grid gap-6 lg:grid-cols-2">
                    <AnimateIn direction="up" delay={150}>
                        <Card>
                            <CardContent className="p-6">
                                <h2 className="mb-4 text-lg font-semibold inline-flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    Mode breakdown
                                </h2>
                                <ModeBreakdown dist={derived.modeDist} />
                            </CardContent>
                        </Card>
                    </AnimateIn>

                    <AnimateIn direction="up" delay={200}>
                        <Card>
                            <CardContent className="p-6">
                                <h2 className="mb-4 text-lg font-semibold inline-flex items-center gap-2">
                                    <Code2 className="h-4 w-4 text-primary" />
                                    Practice
                                </h2>
                                <PracticeSummary practice={practice} />
                            </CardContent>
                        </Card>
                    </AnimateIn>
                </div>

                <AnimateIn direction="up" delay={200}>
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="mb-4 text-lg font-semibold">Recent matches</h2>
                            <DataState
                                isLoading={historyLoading}
                                isEmpty={!historyLoading && (history?.length ?? 0) === 0}
                                loading={
                                    <div className="space-y-2">
                                        {[0, 1, 2].map((i) => (
                                            <Skeleton key={i} className="h-16 w-full" />
                                        ))}
                                    </div>
                                }
                                empty={
                                    <p className="text-sm text-muted-foreground">
                                        @{username} hasn't played any matches yet.
                                    </p>
                                }
                            >
                                <div className="space-y-2">
                                    {(history ?? []).slice(0, 10).map((match) => (
                                        <MatchRow
                                            key={match.id}
                                            match={match}
                                            userId={profile.id}
                                        />
                                    ))}
                                </div>
                            </DataState>
                        </CardContent>
                    </Card>
                </AnimateIn>

                <AnimateIn direction="up" delay={250}>
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="mb-4 text-lg font-semibold">Contributions</h2>
                            <ContributionsSection
                                contributions={contributions}
                                isLoading={contributionsLoading}
                                username={profile.username}
                            />
                        </CardContent>
                    </Card>
                </AnimateIn>
            </div>
        </div>
    );
}

function PracticeSummary({ practice }: { practice: PracticeStats | undefined }) {
    if (!practice) {
        return <Skeleton className="h-20 w-full" />;
    }
    if (!practice.isTracked) {
        return (
            <p className="text-sm text-muted-foreground">
                Practice stats are tracked for PRO accounts only.
            </p>
        );
    }
    if (practice.totalAttempts === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No practice attempts yet.
            </p>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Solved
                </p>
                <p className="mt-1 text-2xl font-bold">{practice.totalSolved}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Attempts
                </p>
                <p className="mt-1 text-2xl font-bold">{practice.totalAttempts}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Solve rate
                </p>
                <p className="mt-1 text-2xl font-bold">
                    {Math.round(practice.solveRate * 100)}%
                </p>
            </div>
        </div>
    );
}
