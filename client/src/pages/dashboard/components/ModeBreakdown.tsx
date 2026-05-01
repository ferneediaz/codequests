import type { BattleMode } from '@/types/api';
import { getModeMeta } from '../utils';

export function ModeBreakdown({ dist }: { dist: Record<BattleMode, number> }) {
    const entries = Object.keys(dist)
        .map((mode) => ({ mode, count: dist[mode as BattleMode] }))
        .filter((e) => e.count > 0)
        .sort((a, b) => b.count - a.count);
    const total = entries.reduce((a, b) => a + b.count, 0);

    if (total === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Play a match to see your mode breakdown.
            </p>
        );
    }

    return (
        <div className="space-y-2.5">
            {entries.map(({ mode, count }) => {
                const pct = Math.round((count / total) * 100);
                const meta = getModeMeta(mode);
                const Icon = meta.icon;
                return (
                    <div key={mode}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                                {meta.label}
                            </span>
                            <span className="font-mono text-muted-foreground">
                                {count} · {pct}%
                            </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                            <div
                                className="h-full rounded-full bg-primary/70"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
