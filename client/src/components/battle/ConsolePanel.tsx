import { useState } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import type { TestCaseResult } from '@/types/api';

interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
    isHidden: boolean;
}

interface ConsolePanelProps {
    testCases: TestCase[];
    results?: TestCaseResult[] | null;
    isRunning: boolean;
    resultLabel?: string;
}

export function ConsolePanel({
    testCases,
    results,
    isRunning,
    resultLabel,
}: ConsolePanelProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState(0);

    const visibleTests = testCases.filter((tc) => !tc.isHidden);
    const selectedTest = visibleTests[activeTab];
    const selectedResult = selectedTest
        ? results?.find((r) => r.testCaseId === selectedTest.id)
        : undefined;

    const passedCount = results?.filter((r) => r.passed).length ?? 0;
    const totalCount = results?.length ?? 0;

    if (collapsed) {
        return (
            <div className="flex items-center justify-between border-t border-border bg-card px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Console</span>
                    {results && (
                        <span
                            className={`text-xs font-medium ${
                                passedCount === totalCount
                                    ? 'text-green-400'
                                    : 'text-red-400'
                            }`}
                        >
                            {passedCount}/{totalCount} passed
                        </span>
                    )}
                    {isRunning && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                </div>
                <button
                    onClick={() => setCollapsed(false)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <ChevronUp className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col border-t border-border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">Console</span>
                    {resultLabel && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {resultLabel}
                        </span>
                    )}
                    {isRunning && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                </div>
                <button
                    onClick={() => setCollapsed(true)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                    <ChevronDown className="h-4 w-4" />
                </button>
            </div>

            {/* Test case tabs */}
            {visibleTests.length > 0 && (
                <div className="flex gap-1 overflow-x-auto border-b border-border px-4 py-1.5">
                    {visibleTests.map((tc, i) => {
                        const result = results?.find((r) => r.testCaseId === tc.id);
                        const isActive = i === activeTab;
                        return (
                            <button
                                key={tc.id}
                                onClick={() => setActiveTab(i)}
                                className={`flex shrink-0 items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                        ? 'bg-muted text-foreground'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                }`}
                            >
                                {result && (
                                    <span
                                        className={`inline-block h-2 w-2 rounded-full ${
                                            result.passed
                                                ? 'bg-green-400'
                                                : 'bg-red-400'
                                        }`}
                                    />
                                )}
                                Case {i + 1}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Result area */}
            <div className="flex-1 overflow-y-auto p-4">
                {selectedTest ? (
                    <div className="space-y-3">
                        {/* Pass/fail badge */}
                        {selectedResult && (
                            <div className="flex items-center gap-2">
                                <span
                                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                                        selectedResult.passed
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                    }`}
                                >
                                    {selectedResult.passed ? '✓ Passed' : '✗ Failed'}
                                </span>
                                {selectedResult.executionTime != null && (
                                    <span className="text-xs text-muted-foreground">
                                        {selectedResult.executionTime}ms
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Input */}
                        <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                                Input
                            </div>
                            <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                                {selectedTest.input}
                            </div>
                        </div>

                        {/* Expected output */}
                        <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">
                                Expected Output
                            </div>
                            <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
                                {selectedTest.expectedOutput}
                            </div>
                        </div>

                        {/* Actual output (only after run/submit) */}
                        {selectedResult && (
                            <div>
                                <div className="mb-1 text-xs font-medium text-muted-foreground">
                                    Output
                                </div>
                                <div
                                    className={`rounded-md px-3 py-2 font-mono text-xs ${
                                        selectedResult.passed
                                            ? 'bg-green-500/10 text-green-400'
                                            : 'bg-red-500/10 text-red-400'
                                    }`}
                                >
                                    {selectedResult.actualOutput ?? '(no output)'}
                                </div>
                            </div>
                        )}

                        {/* Console Output (user's console.log / print) */}
                        {selectedResult && (
                            <div>
                                <div className="mb-1 text-xs font-medium text-muted-foreground">
                                    Console Output
                                </div>
                                {selectedResult.stdout ? (
                                    <div className="rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-foreground whitespace-pre-wrap">
                                        {selectedResult.stdout}
                                    </div>
                                ) : (
                                    <div className="rounded-md bg-muted/30 px-3 py-2 font-mono text-xs italic text-muted-foreground">
                                        No output. Use console.log / print to debug.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stderr (captured separately; shown in red) */}
                        {selectedResult?.stderr && (
                            <div>
                                <div className="mb-1 text-xs font-medium text-red-400">
                                    Stderr
                                </div>
                                <div className="rounded-md bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400 whitespace-pre-wrap">
                                    {selectedResult.stderr}
                                </div>
                            </div>
                        )}

                        {/* Error (execution-level, e.g. timeout / network) */}
                        {selectedResult?.error && selectedResult.error !== selectedResult.stderr && (
                            <div>
                                <div className="mb-1 text-xs font-medium text-red-400">
                                    Error
                                </div>
                                <div className="rounded-md bg-red-500/10 px-3 py-2 font-mono text-xs text-red-400 whitespace-pre-wrap">
                                    {selectedResult.error}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        No test cases available
                    </div>
                )}
            </div>

            {/* Status bar */}
            {results && (
                <div className="flex items-center justify-between border-t border-border px-4 py-1.5">
                    <span
                        className={`text-xs font-medium ${
                            passedCount === totalCount
                                ? 'text-green-400'
                                : 'text-red-400'
                        }`}
                    >
                        {passedCount}/{totalCount} test cases passed
                    </span>
                </div>
            )}
        </div>
    );
}
