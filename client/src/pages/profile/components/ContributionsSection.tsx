import { Skeleton } from '@/components/ui/skeleton';
import { DataState } from '@/components/layout/DataState';
import type { ProblemContribution } from '@/types/api';
import { ContributionsRow } from './ContributionsRow';

interface ContributionsSectionProps {
    contributions: ProblemContribution[] | undefined;
    isLoading: boolean;
    username: string;
}

export function ContributionsSection({
    contributions,
    isLoading,
    username,
}: ContributionsSectionProps) {
    return (
        <DataState
            isLoading={isLoading}
            isEmpty={!isLoading && (contributions?.length ?? 0) === 0}
            loading={
                <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                    ))}
                </div>
            }
            empty={
                <p className="text-sm text-muted-foreground">
                    @{username} hasn't contributed any problems yet.
                </p>
            }
        >
            <ul className="space-y-2">
                {(contributions ?? []).map((problem) => (
                    <ContributionsRow key={problem.id} problem={problem} />
                ))}
            </ul>
        </DataState>
    );
}
