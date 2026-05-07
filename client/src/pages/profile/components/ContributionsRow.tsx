import { Badge } from '@/components/ui/badge';
import type { Difficulty } from '@/types/api';
import type { ProblemContribution } from '@/types/api';

const DIFFICULTY_META: Record<
    Difficulty,
    { label: string; className: string }
> = {
    EASY: { label: 'Easy', className: 'text-green-500 border-green-500/30 bg-green-500/10' },
    MEDIUM: { label: 'Medium', className: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10' },
    HARD: { label: 'Hard', className: 'text-red-500 border-red-500/30 bg-red-500/10' },
};

export function ContributionsRow({ problem }: { problem: ProblemContribution }) {
    const meta = DIFFICULTY_META[problem.difficulty];
    return (
        <li className="flex items-center gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{problem.title}</p>
                    <Badge variant="outline" className={meta.className}>
                        {meta.label}
                    </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {problem.tags.length === 0 ? (
                        <span className="italic">no tags</span>
                    ) : (
                        problem.tags.map((t) => <span key={t}>#{t}</span>)
                    )}
                </div>
            </div>
        </li>
    );
}
