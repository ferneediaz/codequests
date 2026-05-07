import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { DataState } from '@/components/layout/DataState';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SubmissionStatusBadge } from '@/components/admin/SubmissionStatusBadge';
import { problemSubmissionsApi } from '@/services/problemSubmissions';
import type { ProblemSubmission, SubmissionStatus } from '@/types/submission';

type StatusFilter = 'PENDING' | 'NEEDS_CHANGES' | 'HISTORY';

const FILTERS: Array<{ key: StatusFilter; label: string; status?: SubmissionStatus }> = [
    { key: 'PENDING', label: 'Pending', status: 'PENDING' },
    { key: 'NEEDS_CHANGES', label: 'Awaiting changes', status: 'NEEDS_CHANGES' },
    { key: 'HISTORY', label: 'History' }, // approved + rejected, fetched without status filter when active
];

const DIFFICULTY_LABEL: Record<ProblemSubmission['difficulty'], string> = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

export default function ReviewQueue() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState<StatusFilter>('PENDING');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['adminSubmissions', filter, search] as const,
        queryFn: () =>
            problemSubmissionsApi.listForReview({
                status:
                    filter === 'HISTORY'
                        ? undefined
                        : (FILTERS.find((f) => f.key === filter)?.status as SubmissionStatus),
                search: search.trim() || undefined,
                limit: 50,
            }),
    });

    const items =
        filter === 'HISTORY'
            ? (data?.items ?? []).filter((s) => s.status === 'APPROVED' || s.status === 'REJECTED')
            : (data?.items ?? []);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-5xl space-y-6 px-4 py-8">
                <PageHero
                    icon={<ClipboardCheck className="h-8 w-8 text-primary" />}
                    eyebrow="Admin"
                    title="Review queue"
                    description="Run, approve, and triage community-contributed problems."
                />

                <AnimateIn delay={75}>
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <div className="flex flex-wrap gap-2">
                                {FILTERS.map((f) => (
                                    <Button
                                        key={f.key}
                                        size="sm"
                                        variant={filter === f.key ? 'default' : 'outline'}
                                        onClick={() => setFilter(f.key)}
                                    >
                                        {f.label}
                                    </Button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by problem title or contributor"
                                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </AnimateIn>

                <AnimateIn delay={150}>
                    <Card>
                        <CardContent className="p-0">
                            <DataState
                                isLoading={isLoading}
                                isEmpty={items.length === 0}
                                loading={
                                    <div className="space-y-2 p-4">
                                        {[...Array(4)].map((_, i) => (
                                            <Skeleton key={i} className="h-20 w-full" />
                                        ))}
                                    </div>
                                }
                                empty={
                                    <div className="py-16 text-center">
                                        <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                        <p className="text-muted-foreground">
                                            {filter === 'PENDING'
                                                ? 'No submissions waiting for review.'
                                                : filter === 'NEEDS_CHANGES'
                                                  ? 'No submissions awaiting contributor revisions.'
                                                  : 'No reviewed submissions yet.'}
                                        </p>
                                    </div>
                                }
                            >
                                <ul className="divide-y divide-border/60">
                                    {items.map((submission) => (
                                        <li
                                            key={submission.id}
                                            className="cursor-pointer px-5 py-4 transition-colors hover:bg-muted/50"
                                            onClick={() =>
                                                navigate(`/admin/review/${submission.id}`)
                                            }
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold">
                                                    {submission.title}
                                                </span>
                                                <SubmissionStatusBadge status={submission.status} />
                                                <span className="text-[11px] text-muted-foreground">
                                                    {DIFFICULTY_LABEL[submission.difficulty]}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                @{submission.submittedBy?.username ?? 'unknown'} ·{' '}
                                                Submitted {formatDate(submission.createdAt)}
                                                {submission.tags.length > 0 && ' · '}
                                                {submission.tags.join(', ')}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </DataState>
                        </CardContent>
                    </Card>
                </AnimateIn>
            </div>
        </div>
    );
}
