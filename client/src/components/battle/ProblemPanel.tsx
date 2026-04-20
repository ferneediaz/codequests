import type { ProblemResponse } from '@/types/api';
import type { TestCaseResult } from '@/types/api';

interface ProblemPanelProps {
    problem: ProblemResponse;
    submissionResults?: TestCaseResult[] | null;
}

export function ProblemPanel({ problem, submissionResults }: ProblemPanelProps) {
    const visibleTests = problem.testCases?.filter((tc) => !tc.isHidden) ?? [];

    return (
        <div className="flex h-full flex-col overflow-y-auto p-4">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-foreground">{problem.title}</h2>
                <span
                    className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${problem.difficulty === 'EASY'
                            ? 'bg-green-500/20 text-green-400'
                            : problem.difficulty === 'MEDIUM'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                        }`}
                >
                    {problem.difficulty}
                </span>
            </div>

            <div className="prose prose-invert mb-6 max-w-none text-sm">
                <p className="whitespace-pre-wrap text-foreground/90">{problem.description}</p>
            </div>

            {visibleTests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Examples</h3>
                    {visibleTests.map((tc, i) => {
                        const result = submissionResults?.find((r) => r.testCaseId === tc.id);

                        return (
                            <div
                                key={tc.id}
                                className={`rounded-lg border p-3 text-sm ${result
                                        ? result.passed
                                            ? 'border-green-500/50 bg-green-500/5'
                                            : 'border-red-500/50 bg-red-500/5'
                                        : 'border-border bg-card'
                                    }`}
                            >
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="font-medium text-muted-foreground">
                                        Example {i + 1}
                                    </span>
                                    {result && (
                                        <span
                                            className={`text-xs font-semibold ${result.passed ? 'text-green-400' : 'text-red-400'
                                                }`}
                                        >
                                            {result.passed ? '✓ Passed' : '✗ Failed'}
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1 font-mono text-xs">
                                    <div>
                                        <span className="text-muted-foreground">Input: </span>
                                        <span className="text-foreground">{tc.input}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Expected: </span>
                                        <span className="text-foreground">{tc.expectedOutput}</span>
                                    </div>
                                    {result && !result.passed && result.actualOutput && (
                                        <div>
                                            <span className="text-muted-foreground">Got: </span>
                                            <span className="text-red-400">{result.actualOutput}</span>
                                        </div>
                                    )}
                                    {result?.error && (
                                        <div className="mt-1 text-red-400">Error: {result.error}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
