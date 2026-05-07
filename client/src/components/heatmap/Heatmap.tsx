export function Heatmap({
    grid,
    dates,
    breakdown,
    monthLabels,
    max,
}: {
    grid: number[][];
    dates: (Date | null)[][];
    breakdown: { battles: number; githubCommits: number; total: number }[][];
    monthLabels: (string | null)[];
    max: number;
}) {
    const intensity = (count: number) => {
        if (count === 0 || max === 0) return 'bg-muted/40';
        const ratio = count / max;
        if (ratio > 0.75) return 'bg-primary';
        if (ratio > 0.5) return 'bg-primary/75';
        if (ratio > 0.25) return 'bg-primary/50';
        return 'bg-primary/25';
    };

    const dayLabels = ['Mon', 'Wed', 'Fri'];

    return (
        <div className="flex gap-3">
            <div className="pt-5">
                <div className="flex h-full flex-col justify-between py-0.5 text-[10px] text-muted-foreground">
                    {dayLabels.map((d) => (
                        <span key={d}>{d}</span>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-x-auto pb-1 [scrollbar-color:theme(colors.border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80 [&::-webkit-scrollbar-thumb:hover]:bg-primary/60 [&::-webkit-scrollbar-track]:bg-transparent">
                <div className="min-w-[700px] md:min-w-0">
                    <div
                        className="mb-2 grid gap-1 text-[10px] text-muted-foreground"
                        style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}
                    >
                        {monthLabels.map((label, i) => (
                            <div
                                key={i}
                                className="w-0 overflow-visible whitespace-nowrap text-left"
                            >
                                {label ? label.slice(0, 3) : ''}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <div
                            className="grid flex-1 grid-rows-7 gap-1"
                            style={{
                                gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))`,
                                // Fill each week top-to-bottom before moving right,
                                // matching GitHub's contribution heatmap orientation.
                                gridAutoFlow: 'column',
                            }}
                        >
                            {grid.map((week, wi) =>
                                week.map((count, di) => {
                                    const date = dates[wi]?.[di] ?? null;
                                    const cell = breakdown[wi]?.[di] ?? {
                                        battles: 0,
                                        githubCommits: 0,
                                        total: 0,
                                    };
                                    const labelParts = [
                                        `${cell.total} activit${cell.total === 1 ? 'y' : 'ies'}`,
                                        `on ${date?.toLocaleDateString() ?? ''}`,
                                    ];
                                    if (cell.battles > 0) {
                                        labelParts.push(
                                            `${cell.battles} battle${cell.battles === 1 ? '' : 's'}`,
                                        );
                                    }
                                    if (cell.githubCommits > 0) {
                                        labelParts.push(
                                            `${cell.githubCommits} GitHub commit${cell.githubCommits === 1 ? '' : 's'}`,
                                        );
                                    }
                                    const title = date ? labelParts.join(' - ') : '';
                                    return (
                                        <div
                                            key={`${wi}-${di}`}
                                            className={`aspect-square w-full rounded-[3px] transition-colors ${date ? intensity(count) : 'bg-transparent'}`}
                                            title={title}
                                        />
                                    );
                                }),
                            )}
                        </div>
                        <div className="flex shrink-0 flex-col justify-end gap-1 text-[10px] text-muted-foreground">
                            <span>Less</span>
                            <div className="flex gap-0.5">
                                <div className="h-2.5 w-2.5 rounded-sm bg-muted/40" />
                                <div className="h-2.5 w-2.5 rounded-sm bg-primary/25" />
                                <div className="h-2.5 w-2.5 rounded-sm bg-primary/50" />
                                <div className="h-2.5 w-2.5 rounded-sm bg-primary/75" />
                                <div className="h-2.5 w-2.5 rounded-sm bg-primary" />
                            </div>
                            <span>More</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
