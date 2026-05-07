import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { DataState } from '@/components/layout/DataState';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SubmissionStatusBadge } from '@/components/admin/SubmissionStatusBadge';
import { problemSubmissionsApi } from '@/services/problemSubmissions';
import type { ProblemSubmission } from '@/types/submission';

const DIFFICULTY_LABEL: Record<ProblemSubmission['difficulty'], string> = {
    EASY: 'Easy',
    MEDIUM: 'Medium',
    HARD: 'Hard',
};

function formatDate(iso: string): string {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export default function MySubmissions() {
    const navigate = useNavigate();
    const { data, isLoading } = useQuery({
        queryKey: ['problemSubmissions', 'mine'] as const,
        queryFn: () => problemSubmissionsApi.listMine(),
    });

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />
            <div className="relative mx-auto max-w-5xl space-y-6 px-4 py-8">
                <PageHero
                    icon={<Sparkles className="h-8 w-8 text-primary" />}
                    eyebrow="Community problems"
                    title="My contributions"
                    description="Track problems you've submitted to the community library. We notify you the moment a reviewer takes action."
                    aside={
                        <Link to="/contribute">
                            <Button>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Submit a problem
                            </Button>
                        </Link>
                    }
                />

                <AnimateIn delay={75}>
                    <Card>
                        <CardContent className="p-0">
                            <DataState
                                isLoading={isLoading}
                                isEmpty={!data || data.length === 0}
                                loading={
                                    <div className="space-y-2 p-4">
                                        {[...Array(3)].map((_, i) => (
                                            <Skeleton key={i} className="h-20 w-full" />
                                        ))}
                                    </div>
                                }
                                empty={
                                    <div className="py-16 text-center">
                                        <Sparkles className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                                        <p className="mb-4 text-muted-foreground">
                                            You haven't submitted a problem yet.
                                        </p>
                                        <Link to="/contribute">
                                            <Button>
                                                <Plus className="mr-1.5 h-4 w-4" />
                                                Submit your first problem
                                            </Button>
                                        </Link>
                                    </div>
                                }
                            >
                                <ul className="divide-y divide-border/60">
                                    {(data ?? []).map((submission) => (
                                        <SubmissionRow
                                            key={submission.id}
                                            submission={submission}
                                            onEdit={() =>
                                                navigate(`/contribute/${submission.id}/edit`)
                                            }
                                            onView={() =>
                                                submission.linkedProblem
                                                    ? navigate(
                                                          `/practice/${submission.linkedProblem.id}`,
                                                      )
                                                    : undefined
                                            }
                                        />
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

interface SubmissionRowProps {
    submission: ProblemSubmission;
    onEdit: () => void;
    onView: () => void;
}

function SubmissionRow({ submission, onEdit, onView }: SubmissionRowProps) {
    const isApproved = submission.status === 'APPROVED' && submission.linkedProblem;
    const canEdit = submission.status === 'NEEDS_CHANGES';
    return (
        <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                        {submission.title}
                    </span>
                    <SubmissionStatusBadge status={submission.status} />
                    <span className="text-[11px] text-muted-foreground">
                        {DIFFICULTY_LABEL[submission.difficulty]}
                    </span>
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    Submitted {formatDate(submission.createdAt)}
                    {submission.tags.length > 0 && ' · '}
                    {submission.tags.join(', ')}
                </div>
                {submission.reviewNotes && (
                    <p className="mt-2 max-w-xl rounded-md border border-border/60 bg-muted/40 p-2 text-xs text-foreground/80">
                        <span className="font-medium text-muted-foreground">
                            Reviewer:
                        </span>{' '}
                        {submission.reviewNotes}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                {canEdit && (
                    <Button size="sm" onClick={onEdit}>
                        Edit & resubmit
                    </Button>
                )}
                {isApproved && (
                    <Button size="sm" variant="outline" onClick={onView}>
                        View live problem
                    </Button>
                )}
            </div>
        </li>
    );
}
