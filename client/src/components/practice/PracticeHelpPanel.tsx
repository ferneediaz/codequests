import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownContent } from '@/components/MarkdownContent';

interface PracticeHelpPanelProps {
    hints: string[];
    solution: string;
}

export function PracticeHelpPanel({ hints, solution }: PracticeHelpPanelProps) {
    const [revealedHints, setRevealedHints] = useState(0);
    const [solutionOpen, setSolutionOpen] = useState(false);

    const totalHints = hints.length;
    const canShowMore = revealedHints < totalHints;

    return (
        <div className="space-y-4 border-t border-border p-4">
            {totalHints > 0 && (
                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Hints
                            <span className="text-xs font-normal text-muted-foreground">
                                ({revealedHints}/{totalHints})
                            </span>
                        </h3>
                        <div className="flex items-center gap-1.5">
                            {canShowMore && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRevealedHints((n) => n + 1)}
                                >
                                    Show hint {revealedHints + 1}
                                </Button>
                            )}
                            {revealedHints > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRevealedHints(0)}
                                >
                                    Hide
                                </Button>
                            )}
                        </div>
                    </div>

                    {revealedHints === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Stuck? Reveal hints one at a time — each goes a little deeper
                            toward the solution.
                        </p>
                    ) : (
                        <ol className="space-y-2">
                            {hints.slice(0, revealedHints).map((hint, i) => (
                                <li
                                    key={i}
                                    className="flex gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-foreground/90"
                                >
                                    <span className="shrink-0 font-mono text-xs font-semibold text-yellow-500">
                                        #{i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <MarkdownContent markdown={hint} compact />
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            )}

            {solution && (
                <section>
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                            Solution
                        </h3>
                        <Button
                            size="sm"
                            variant={solutionOpen ? 'ghost' : 'outline'}
                            onClick={() => setSolutionOpen((v) => !v)}
                        >
                            {solutionOpen ? (
                                <>
                                    <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                                    Hide solution
                                    <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                                </>
                            ) : (
                                <>
                                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                                    Show solution
                                    <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                                </>
                            )}
                        </Button>
                    </div>

                    {solutionOpen ? (
                        <div className="rounded-lg border border-border bg-card p-3">
                            <MarkdownContent markdown={solution} />
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            Give it a real attempt first — the reference solution is always
                            here when you want to compare.
                        </p>
                    )}
                </section>
            )}
        </div>
    );
}
