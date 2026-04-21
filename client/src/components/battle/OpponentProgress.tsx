import { CheckCircle2, Circle } from 'lucide-react';

interface OpponentProgressProps {
    username: string;
    testsPassed: number;
    totalTests: number;
    label?: string;
    align?: 'left' | 'right';
}

export function OpponentProgress({
    username,
    testsPassed,
    totalTests,
    label,
    align = 'left',
}: OpponentProgressProps) {
    const total = Math.max(totalTests, 0);
    const passed = Math.min(Math.max(testsPassed, 0), total);

    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2">
            <div
                className={`mb-1 flex items-center justify-between gap-2 text-xs ${
                    align === 'right' ? 'flex-row-reverse' : ''
                }`}
            >
                <span className="truncate font-medium text-foreground">
                    {label ?? username}
                </span>
                <span className="font-mono text-muted-foreground">
                    {passed}/{total}
                </span>
            </div>
            <div
                className={`flex flex-wrap gap-1 ${
                    align === 'right' ? 'justify-end' : ''
                }`}
            >
                {total === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                        Awaiting tests…
                    </span>
                )}
                {Array.from({ length: total }).map((_, i) =>
                    i < passed ? (
                        <CheckCircle2
                            key={i}
                            className="h-3.5 w-3.5 text-green-400"
                            strokeWidth={2.5}
                        />
                    ) : (
                        <Circle
                            key={i}
                            className="h-3.5 w-3.5 text-muted-foreground/40"
                        />
                    ),
                )}
            </div>
        </div>
    );
}
