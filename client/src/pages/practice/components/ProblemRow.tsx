import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export function ProblemRow({
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
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center"
                    title={
                        !isTracked
                            ? 'Upgrade to Pro to track your progress on this problem'
                            : problem.solved
                                ? 'Solved'
                                : 'Not yet solved'
                    }
                    aria-label={
                        !isTracked
                            ? 'Locked — upgrade to track progress'
                            : problem.solved
                                ? 'Solved'
                                : 'Not yet solved'
                    }
                >
                    {!isTracked ? (
                        <Lock className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                    ) : problem.solved ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden />
                    ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" aria-hidden />
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
