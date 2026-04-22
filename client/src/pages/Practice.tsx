import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    BookOpen,
    CheckCircle2,
    Circle,
    Filter,
    Lock,
    Target,
    Trophy,
    Sparkles,
    Activity,
} from 'lucide-react';
import { practiceApi } from '@/services/practice';
import type { Difficulty } from '@/types/api';
import type { PracticeProblemSummary } from '@/types/practice';

const DIFFICULTY_META: Record<
    Difficulty,
    { label: string; className: string }
> = {
    EASY: { label: 'Easy', className: 'text-green-500 border-green-500/30 bg-green-500/10' },
    MEDIUM: { label: 'Medium', className: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
    HARD: { label: 'Hard', className: 'text-red-500 border-red-500/30 bg-red-500/10' },
};

const DIFFICULTIES: (Difficulty | 'ALL')[] = ['ALL', 'EASY', 'MEDIUM', 'HARD'];

export default function Practice() {
    const navigate = useNavigate();
    const [difficulty, setDifficulty] = useState<Difficulty | 'ALL'>('ALL');
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [unsolvedOnly, setUnsolvedOnly] = useState(false);

    const { data: problems, isLoading } = useQuery<PracticeProblemSummary[]>({
        queryKey: ['practice', 'problems'],
        queryFn: () => practiceApi.listProblems(),
    });

    const { data: stats } = useQuery({
        queryKey: ['practice', 'stats'],
        queryFn: () => practiceApi.getStats(),
    });

    const allTags = useMemo(() => {
        const s = new Set<string>();
        for (const p of problems ?? []) for (const t of p.tags) s.add(t);
        return Array.from(s).sort();
    }, [problems]);

    const filtered = useMemo(() => {
        let list = problems ?? [];
        if (difficulty !== 'ALL') list = list.filter((p) => p.difficulty === difficulty);
        if (selectedTags.size > 0) {
            list = list.filter((p) => p.tags.some((t) => selectedTags.has(t)));
        }
        if (unsolvedOnly) list = list.filter((p) => !p.solved);
        return list;
    }, [problems, difficulty, selectedTags, unsolvedOnly]);

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
        });
    };

    const solvedCount = (problems ?? []).filter((p) => p.solved).length;
    const totalCount = problems?.length ?? 0;

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-6xl px-4 py-8 space-y-6">
                {/* Header */}
                <AnimateIn direction="up">
                    <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-blue-500/10 p-8 backdrop-blur-sm">
                        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-primary/30 blur-3xl opacity-40" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-5">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background/60 text-3xl shadow-lg">
                                    <BookOpen className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">No pressure, no clock</p>
                                    <h1 className="text-3xl font-extrabold tracking-tight">
                                        Practice Ground
                                    </h1>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Solve problems at your own pace. Free and unlimited.
                                    </p>
                                </div>
                            </div>

                            {stats && (
                                <div className="flex gap-3">
                                    <MiniStat
                                        icon={<Target className="h-4 w-4" />}
                                        label="Solved"
                                        value={`${solvedCount}/${totalCount}`}
                                    />
                                    <MiniStat
                                        icon={<Activity className="h-4 w-4" />}
                                        label="Attempts"
                                        value={stats.totalAttempts.toString()}
                                    />
                                    <MiniStat
                                        icon={<Trophy className="h-4 w-4" />}
                                        label="Solve rate"
                                        value={`${stats.solveRate}%`}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </AnimateIn>

                {stats && !stats.isTracked && (
                    <AnimateIn>
                        <UpsellBanner />
                    </AnimateIn>
                )}

                {/* Filters */}
                <AnimateIn delay={75}>
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Filter className="h-4 w-4 text-primary" />
                                Filters
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {DIFFICULTIES.map((d) => (
                                    <Button
                                        key={d}
                                        size="sm"
                                        variant={difficulty === d ? 'default' : 'outline'}
                                        onClick={() => setDifficulty(d)}
                                    >
                                        {d === 'ALL' ? 'All Difficulties' : DIFFICULTY_META[d].label}
                                    </Button>
                                ))}
                            </div>

                            {allTags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {allTags.map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedTags.has(tag)
                                                ? 'border-primary bg-primary/20 text-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <input
                                        type="checkbox"
                                        checked={unsolvedOnly}
                                        onChange={(e) => setUnsolvedOnly(e.target.checked)}
                                        className="h-4 w-4 rounded border-border accent-primary"
                                    />
                                    Unsolved only
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                </AnimateIn>

                {/* Problem list */}
                <AnimateIn delay={150}>
                    <Card>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-2 p-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-16 w-full" />
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="py-16 text-center">
                                    <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                    <p className="text-muted-foreground">
                                        No problems match your filters.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-border/60">
                                    {filtered.map((problem) => (
                                        <ProblemRow
                                            key={problem.id}
                                            problem={problem}
                                            isTracked={stats?.isTracked ?? false}
                                            onClick={() => navigate(`/practice/${problem.id}`)}
                                        />
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </AnimateIn>
            </div>
        </div>
    );
}

function MiniStat({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-background/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                {label}
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
        </div>
    );
}

function ProblemRow({
    problem,
    isTracked,
    onClick,
}: {
    problem: PracticeProblemSummary;
    isTracked: boolean;
    onClick: () => void;
}) {
    const meta = DIFFICULTY_META[problem.difficulty];
    return (
        <li>
            <button
                onClick={onClick}
                className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-card/60"
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    {!isTracked ? (
                        <Lock className="h-4 w-4 text-muted-foreground/50" />
                    ) : problem.solved ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{problem.title}</p>
                        <Badge variant="outline" className={meta.className}>
                            {meta.label}
                        </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {problem.tags.map((t) => (
                            <span key={t}>#{t}</span>
                        ))}
                    </div>
                </div>

                <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {isTracked
                        ? problem.attempts > 0
                            ? `${problem.attempts} attempt${problem.attempts === 1 ? '' : 's'}`
                            : 'No attempts'
                        : 'Upgrade to track'}
                </div>
            </button>
        </li>
    );
}

function UpsellBanner() {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
            <div className="flex-1">
                <p className="font-semibold text-foreground">
                    Practice is free — stats tracking is a Pro perk.
                </p>
                <p className="mt-1 text-muted-foreground">
                    You can run and submit any problem unlimited times. Upgrade to Pro
                    (or start a free trial) to save attempt history, get a solve-rate
                    breakdown, and see which topics you crush.
                </p>
            </div>
        </div>
    );
}
