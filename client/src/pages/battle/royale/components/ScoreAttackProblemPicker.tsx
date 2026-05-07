import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BattleRoundSubmission, ProblemPoolItem } from '@/types/api';

interface ScoreAttackProblemPickerProps {
    problems: ProblemPoolItem[];
    activeProblemId: string | null;
    submissions: BattleRoundSubmission[];
    currentUserId?: string;
    onSelect: (problemId: string) => void;
}

export function ScoreAttackProblemPicker({
    problems,
    activeProblemId,
    submissions,
    currentUserId,
    onSelect,
}: ScoreAttackProblemPickerProps) {
    const solvedProblemIds = useMemo(
        () =>
            new Set(
                submissions
                    .filter(
                        (submission) =>
                            submission.userId === currentUserId &&
                            submission.allPassed,
                    )
                    .map((submission) => submission.problemId)
                    .filter((id): id is string => !!id),
            ),
        [submissions, currentUserId],
    );

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Score Attack Pool</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2 overflow-x-auto pb-4">
                {problems.map((problem) => {
                    const active = activeProblemId === problem.problemId;
                    const solved = solvedProblemIds.has(problem.problemId);
                    return (
                        <button
                            key={problem.problemId}
                            type="button"
                            onClick={() => onSelect(problem.problemId)}
                            className={`min-w-52 rounded-lg border p-3 text-left transition-colors ${
                                active
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border hover:border-primary/40'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-semibold">
                                    {problem.title}
                                </p>
                                {solved && (
                                    <Badge className="shrink-0 bg-green-500/20 text-green-500">
                                        Solved
                                    </Badge>
                                )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <Badge variant="outline">{problem.difficulty}</Badge>
                                <Badge variant="secondary">{problem.pointValue} pts</Badge>
                            </div>
                        </button>
                    );
                })}
                {problems.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                        Waiting for the server problem pool.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
