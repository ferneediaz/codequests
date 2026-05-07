import type { ProblemResponse } from '@/types/api';
import { Link } from 'react-router-dom';
import { MarkdownContent } from '@/components/MarkdownContent';

interface ProblemPanelProps {
    problem: ProblemResponse;
}

export function ProblemPanel({ problem }: ProblemPanelProps) {
    const visibleTests = problem.testCases?.filter((tc) => !tc.isHidden) ?? [];

    return (
        <div className="flex flex-col p-4">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground">{problem.title}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${problem.difficulty === 'EASY'
                            ? 'bg-green-500/20 text-green-400'
                            : problem.difficulty === 'MEDIUM'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                    >
                        {problem.difficulty}
                    </span>
                    {problem.contributedBy && (
                        <span className="text-[11px] text-muted-foreground">
                            Contributed by{' '}
                            <Link
                                to={`/profile/${problem.contributedBy.username}`}
                                className="font-medium text-primary hover:underline"
                            >
                                @{problem.contributedBy.username}
                            </Link>
                        </span>
                    )}
                </div>
            </div>

            <div className="mb-6 max-w-none">
                <MarkdownContent markdown={problem.description} />
            </div>

            {visibleTests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Examples</h3>
                    {visibleTests.map((tc, i) => (
                        <div
                            key={tc.id}
                            className="rounded-lg border border-border bg-card p-3 text-sm"
                        >
                            <div className="mb-1">
                                <span className="font-medium text-muted-foreground">
                                    Example {i + 1}
                                </span>
                            </div>
                            <div className="space-y-1 font-mono text-xs">
                                <div>
                                    <span className="text-muted-foreground">Input: </span>
                                    <span className="text-foreground">{tc.input}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Output: </span>
                                    <span className="text-foreground">{tc.expectedOutput}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
