interface OpponentProgressProps {
    username: string;
    testsPassed: number;
    totalTests: number;
}

export function OpponentProgress({ username, testsPassed, totalTests }: OpponentProgressProps) {
    const percentage = totalTests > 0 ? (testsPassed / totalTests) * 100 : 0;

    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                    {username}
                </span>
                <span className="font-mono text-foreground">
                    {testsPassed}/{totalTests}
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
