import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { User as UserIcon } from 'lucide-react';
import { RankBadge } from '@/components/ui/RankBadge';
import { DataState } from '@/components/layout/DataState';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { queryKeys } from '@/lib/queryKeys';
import { getLeaderboard } from '@/services/users';
import type { LeaderboardUser } from '@/types/api';

const TOP_RANK_COLORS: Record<number, string> = {
    1: '#ffd700',
    2: '#c0c0c0',
    3: '#cd7f32',
};

function AnimateIn({
    children,
    className = '',
    delay = 0,
}: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    const { ref, isVisible } = useScrollAnimation(0.12);
    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            } ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

function RankPill({ rank }: { rank: number }) {
    const color = TOP_RANK_COLORS[rank];
    if (color) {
        return (
            <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-sm shadow-md"
                style={{
                    backgroundColor: `${color}20`,
                    color,
                    boxShadow: `0 0 16px ${color}40`,
                }}
            >
                {rank}
            </span>
        );
    }
    return (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/40 text-sm font-semibold text-muted-foreground">
            {rank}
        </span>
    );
}

function Avatar({ user }: { user: LeaderboardUser }) {
    if (user.avatarUrl) {
        return (
            <img
                src={user.avatarUrl}
                alt={user.username}
                className="h-10 w-10 shrink-0 rounded-full object-cover bg-muted"
            />
        );
    }
    const initial = user.username.charAt(0).toUpperCase();
    return (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initial || <UserIcon className="h-5 w-5" />}
        </span>
    );
}

function LeaderboardRow({ user, rank }: { user: LeaderboardUser; rank: number }) {
    return (
        <Link
            to={`/profile/${user.username}`}
            className="flex items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
            <RankPill rank={rank} />
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-foreground">
                        {user.username}
                    </span>
                    {user.clan && (
                        <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            [{user.clan.tag}]
                        </span>
                    )}
                </div>
                <div className="mt-0.5 text-sm">
                    <RankBadge mmr={user.mmr} showMmr />
                </div>
            </div>
            <div className="hidden shrink-0 text-right text-sm text-muted-foreground sm:block">
                <div className="font-semibold text-foreground">{user.wins}W</div>
                <div className="text-xs">{user.losses}L</div>
            </div>
        </Link>
    );
}

function SkeletonRow() {
    return (
        <div className="flex items-center gap-4 px-4 py-3">
            <span className="h-9 w-9 shrink-0 rounded-full bg-muted/40" />
            <span className="h-10 w-10 shrink-0 rounded-full bg-muted/40" />
            <div className="flex-1 space-y-2">
                <span className="block h-3 w-32 rounded bg-muted/40" />
                <span className="block h-3 w-20 rounded bg-muted/40" />
            </div>
            <span className="hidden h-8 w-10 rounded bg-muted/40 sm:block" />
        </div>
    );
}

export function TopLeaderboard() {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.leaderboard(10),
        queryFn: () => getLeaderboard(10),
        staleTime: 60_000,
    });

    const isEmpty = !isLoading && !error && (data?.length ?? 0) === 0;

    return (
        <section className="py-32 px-6 bg-card/20">
            <div className="mx-auto max-w-3xl">
                <AnimateIn className="text-center mb-12">
                    <h2 className="text-4xl font-bold sm:text-5xl">
                        Top of the <span className="text-primary">ladder</span>
                    </h2>
                    <p className="mt-4 text-lg text-muted-foreground">
                        Live top 10 — real players, real MMR.
                    </p>
                </AnimateIn>

                <AnimateIn delay={150}>
                    <div className="rounded-2xl border border-border bg-background/50 p-3 sm:p-4">
                        <DataState
                            isLoading={isLoading}
                            isEmpty={isEmpty}
                            error={
                                error ? (
                                    <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                                        Leaderboard unavailable right now.
                                    </div>
                                ) : null
                            }
                            loading={
                                <div className="space-y-1">
                                    {Array.from({ length: 10 }).map((_, i) => (
                                        <SkeletonRow key={i} />
                                    ))}
                                </div>
                            }
                            empty={
                                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                                    No players yet — be the first.
                                </div>
                            }
                        >
                            <div className="space-y-1">
                                {data?.map((user, i) => (
                                    <LeaderboardRow
                                        key={user.id}
                                        user={user}
                                        rank={i + 1}
                                    />
                                ))}
                            </div>
                        </DataState>
                    </div>
                </AnimateIn>
            </div>
        </section>
    );
}
