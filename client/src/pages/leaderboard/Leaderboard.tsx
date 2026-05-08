import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    ChevronLeft,
    ChevronRight,
    Globe,
    Shield,
    Users,
    User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RankBadge } from '@/components/ui/RankBadge';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { DataState } from '@/components/layout/DataState';
import { queryKeys } from '@/lib/queryKeys';
import {
    getClanRankings,
    getFriendsRankings,
    getGlobalRankings,
} from '@/services/rankings';
import { useAppSelector } from '@/store/hooks';
import type {
    ClanRankingRow,
    RankingsPeriod,
    UserRankingRow,
} from '@/types/rankings';

type Tab = 'global' | 'friends' | 'clans';

const PAGE_SIZE = 50;

const PERIODS: { value: RankingsPeriod; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'alltime', label: 'All-Time' },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'Any language' },
    { value: 'python', label: 'Python' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'c', label: 'C' },
    { value: 'rust', label: 'Rust' },
];

const TOP_RANK_COLORS: Record<number, string> = {
    1: '#ffd700',
    2: '#c0c0c0',
    3: '#cd7f32',
};

export default function Leaderboard() {
    const viewer = useAppSelector((state) => state.auth.user);
    const isAuthenticated = useAppSelector(
        (state) => state.auth.isAuthenticated,
    );

    const [tab, setTab] = useState<Tab>('global');
    const [period, setPeriod] = useState<RankingsPeriod>('alltime');
    const [language, setLanguage] = useState<string>('');
    const [page, setPage] = useState(0);
    const offset = page * PAGE_SIZE;

    const goToTab = (next: Tab) => {
        setTab(next);
        setPage(0);
    };
    const goToPeriod = (next: RankingsPeriod) => {
        setPeriod(next);
        setPage(0);
    };
    const goToLanguage = (next: string) => {
        setLanguage(next);
        setPage(0);
    };

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-5xl px-4 py-8">
                <AnimateIn direction="up">
                    <div className="mb-8">
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Leaderboard
                        </h1>
                        <p className="mt-2 max-w-xl text-muted-foreground">
                            Climb the ladder. Filter by period, language, or
                            scope to friends and clans.
                        </p>
                    </div>
                </AnimateIn>

                <Card>
                    <CardContent className="space-y-5 p-6">
                        <TabBar
                            tab={tab}
                            onChange={goToTab}
                            isAuthenticated={isAuthenticated}
                        />
                        <FilterBar
                            tab={tab}
                            period={period}
                            language={language}
                            onPeriod={goToPeriod}
                            onLanguage={goToLanguage}
                        />
                        {tab === 'global' && (
                            <GlobalTab
                                period={period}
                                language={language}
                                offset={offset}
                                viewerId={viewer?.id ?? null}
                            />
                        )}
                        {tab === 'friends' && (
                            <FriendsTab
                                period={period}
                                language={language}
                                offset={offset}
                                viewerId={viewer?.id ?? null}
                                isAuthenticated={isAuthenticated}
                            />
                        )}
                        {tab === 'clans' && (
                            <ClansTab period={period} offset={offset} />
                        )}
                        <Pagination
                            page={page}
                            onPrev={() => setPage((p) => Math.max(0, p - 1))}
                            onNext={() => setPage((p) => p + 1)}
                            // Disable Next inside tab components by listening to
                            // a callback would be cleaner, but the page-level
                            // disable is good enough — overshooting just shows
                            // an empty list and the user clicks Prev.
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function TabBar({
    tab,
    onChange,
    isAuthenticated,
}: {
    tab: Tab;
    onChange: (next: Tab) => void;
    isAuthenticated: boolean;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            <TabButton
                active={tab === 'global'}
                onClick={() => onChange('global')}
                icon={<Globe className="h-4 w-4" />}
                label="Global"
            />
            <TabButton
                active={tab === 'friends'}
                onClick={() => onChange('friends')}
                icon={<Users className="h-4 w-4" />}
                label="Friends"
                disabled={!isAuthenticated}
                disabledHint="Log in"
            />
            <TabButton
                active={tab === 'clans'}
                onClick={() => onChange('clans')}
                icon={<Shield className="h-4 w-4" />}
                label="Clans"
            />
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
    disabled = false,
    disabledHint,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
    disabledHint?: string;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={onClick}
            disabled={disabled}
            title={disabled ? disabledHint : undefined}
        >
            <span className="mr-2 inline-flex items-center">{icon}</span>
            {label}
        </Button>
    );
}

function FilterBar({
    tab,
    period,
    language,
    onPeriod,
    onLanguage,
}: {
    tab: Tab;
    period: RankingsPeriod;
    language: string;
    onPeriod: (next: RankingsPeriod) => void;
    onLanguage: (next: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-1.5">
                {PERIODS.map((p) => (
                    <Button
                        key={p.value}
                        type="button"
                        size="sm"
                        variant={period === p.value ? 'secondary' : 'ghost'}
                        onClick={() => onPeriod(p.value)}
                    >
                        {p.label}
                    </Button>
                ))}
            </div>
            {tab !== 'clans' && (
                <div className="ml-auto flex items-center gap-2">
                    <label
                        htmlFor="lang-filter"
                        className="text-xs uppercase tracking-wide text-muted-foreground"
                    >
                        Language
                    </label>
                    <select
                        id="lang-filter"
                        value={language}
                        onChange={(e) => onLanguage(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none"
                    >
                        {LANGUAGE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

function GlobalTab({
    period,
    language,
    offset,
    viewerId,
}: {
    period: RankingsPeriod;
    language: string;
    offset: number;
    viewerId: string | null;
}) {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.rankings.global(
            period,
            language,
            PAGE_SIZE,
            offset,
        ),
        queryFn: () =>
            getGlobalRankings({
                period,
                language: language || undefined,
                limit: PAGE_SIZE,
                offset,
            }),
    });
    return (
        <UserRankingList
            rows={data ?? []}
            isLoading={isLoading}
            error={error}
            language={language}
            viewerId={viewerId}
        />
    );
}

function FriendsTab({
    period,
    language,
    offset,
    viewerId,
    isAuthenticated,
}: {
    period: RankingsPeriod;
    language: string;
    offset: number;
    viewerId: string | null;
    isAuthenticated: boolean;
}) {
    const { data, isLoading, error } = useQuery({
        enabled: isAuthenticated,
        queryKey: queryKeys.rankings.friends(
            period,
            language,
            PAGE_SIZE,
            offset,
        ),
        queryFn: () =>
            getFriendsRankings({
                period,
                language: language || undefined,
                limit: PAGE_SIZE,
                offset,
            }),
    });

    if (!isAuthenticated) {
        return (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                <p>Sign in to see how you stack up against your friends.</p>
                <Link to="/login" className="mt-3 inline-block">
                    <Button size="sm">Log in</Button>
                </Link>
            </div>
        );
    }
    return (
        <UserRankingList
            rows={data ?? []}
            isLoading={isLoading}
            error={error}
            language={language}
            viewerId={viewerId}
        />
    );
}

function ClansTab({
    period,
    offset,
}: {
    period: RankingsPeriod;
    offset: number;
}) {
    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.rankings.clans(period, PAGE_SIZE, offset),
        queryFn: () =>
            getClanRankings({ period, limit: PAGE_SIZE, offset }),
    });
    const rows = data ?? [];
    const isEmpty = !isLoading && !error && rows.length === 0;

    return (
        <DataState
            isLoading={isLoading}
            isEmpty={isEmpty}
            error={error ? <ErrorState /> : null}
            loading={<SkeletonList />}
            empty={<EmptyState scope="clans" />}
        >
            <ul className="space-y-1">
                {rows.map((row) => (
                    <ClanRow key={row.id} row={row} />
                ))}
            </ul>
        </DataState>
    );
}

function UserRankingList({
    rows,
    isLoading,
    error,
    language,
    viewerId,
}: {
    rows: UserRankingRow[];
    isLoading: boolean;
    error: unknown;
    language: string;
    viewerId: string | null;
}) {
    const isEmpty = !isLoading && !error && rows.length === 0;

    return (
        <DataState
            isLoading={isLoading}
            isEmpty={isEmpty}
            error={error ? <ErrorState /> : null}
            loading={<SkeletonList />}
            empty={<EmptyState scope="users" />}
        >
            <ul className="space-y-1">
                {rows.map((row) => (
                    <UserRow
                        key={row.id}
                        row={row}
                        languageActive={language !== ''}
                        isViewer={row.id === viewerId}
                    />
                ))}
            </ul>
        </DataState>
    );
}

function UserRow({
    row,
    languageActive,
    isViewer,
}: {
    row: UserRankingRow;
    languageActive: boolean;
    isViewer: boolean;
}) {
    return (
        <li>
            <Link
                to={`/profile/${row.username}`}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${
                    isViewer
                        ? 'border-primary/60 bg-primary/10'
                        : 'border-transparent hover:border-primary/30 hover:bg-primary/5'
                }`}
            >
                <RankPill rank={row.rank} />
                <Avatar
                    src={row.avatarUrl ?? null}
                    alt={row.username}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                            {row.username}
                        </span>
                        {isViewer && (
                            <Badge variant="secondary" className="text-xs">
                                You
                            </Badge>
                        )}
                        {row.clan && (
                            <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                                [{row.clan.tag}]
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 text-sm">
                        <RankBadge mmr={row.mmr} showMmr />
                    </div>
                </div>
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                    <UserMetric row={row} languageActive={languageActive} />
                </div>
            </Link>
        </li>
    );
}

function UserMetric({
    row,
    languageActive,
}: {
    row: UserRankingRow;
    languageActive: boolean;
}) {
    if (languageActive) {
        return (
            <>
                <div className="font-semibold text-foreground">
                    {row.winsInLanguage ?? 0}W
                </div>
                <div>in lang</div>
            </>
        );
    }
    if (row.mmrGained !== 0) {
        const positive = row.mmrGained > 0;
        return (
            <>
                <div
                    className={`font-semibold ${positive ? 'text-emerald-500' : 'text-red-500'}`}
                >
                    {positive ? '+' : ''}
                    {row.mmrGained}
                </div>
                <div>
                    {row.winsInPeriod}W · {row.lossesInPeriod}L
                </div>
            </>
        );
    }
    return (
        <>
            <div className="font-semibold text-foreground">
                {row.winsInPeriod}W
            </div>
            <div>{row.lossesInPeriod}L</div>
        </>
    );
}

function ClanRow({ row }: { row: ClanRankingRow }) {
    return (
        <li>
            <Link
                to={`/clans/${row.id}`}
                className="flex items-center gap-4 rounded-xl border border-transparent px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
                <RankPill rank={row.rank} />
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Shield className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">
                            {row.name}
                        </span>
                        <span className="shrink-0 rounded bg-muted/50 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                            [{row.tag}]
                        </span>
                    </div>
                    <div className="mt-0.5 text-sm">
                        <RankBadge mmr={row.mmr} showMmr />
                    </div>
                </div>
                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                    <div className="font-semibold text-foreground">
                        {row.winsInPeriod}W
                    </div>
                    <div>
                        {row.lossesInPeriod}L · {row.memberCount} members
                    </div>
                </div>
            </Link>
        </li>
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

function Avatar({ src, alt }: { src: string | null; alt: string }) {
    if (src) {
        return (
            <img
                src={src}
                alt={alt}
                className="h-10 w-10 shrink-0 rounded-full object-cover bg-muted"
            />
        );
    }
    const initial = alt.charAt(0).toUpperCase();
    return (
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {initial || <UserIcon className="h-5 w-5" />}
        </span>
    );
}

function SkeletonList() {
    return (
        <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center gap-4 px-4 py-3"
                >
                    <span className="h-9 w-9 shrink-0 rounded-full bg-muted/40" />
                    <span className="h-10 w-10 shrink-0 rounded-full bg-muted/40" />
                    <div className="flex-1 space-y-2">
                        <span className="block h-3 w-32 rounded bg-muted/40" />
                        <span className="block h-3 w-20 rounded bg-muted/40" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ scope }: { scope: 'users' | 'clans' }) {
    return (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {scope === 'users'
                ? 'No players in this window yet.'
                : 'No clans in this window yet.'}
        </div>
    );
}

function ErrorState() {
    return (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Couldn’t load rankings. Try again in a moment.
        </div>
    );
}

function Pagination({
    page,
    onPrev,
    onNext,
}: {
    page: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    return (
        <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                disabled={page === 0}
            >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Prev
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {page + 1}
            </span>
            <Button variant="outline" size="sm" onClick={onNext}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
}
