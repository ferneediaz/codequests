import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MatchHistoryEntry } from '@/types/api';
import { getMatchResultForUser } from '@/utils/stats';
import { formatRelative, getModeMeta } from '../utils';

export function MatchRow({
    match,
    userId,
}: {
    match: MatchHistoryEntry;
    userId: string;
}) {
    const participants = match.participants ?? [];
    const me = participants.find((p) => p.userId === userId);
    const opponent = participants.find((p) => p.userId !== userId);
    const outcome =
        match.status === 'COMPLETED'
            ? getMatchResultForUser(match, userId)
            : 'pending';
    const pending = outcome === 'pending';
    const won = outcome === 'W';
    const isDraw = match.status === 'COMPLETED' && outcome === 'D';
    const mmrChange = me?.mmrChange;
    const meta = getModeMeta(match.mode);
    const ModeIcon = meta.icon;
    const when = match.endedAt ?? match.startedAt ?? match.createdAt;
    const whenLabel = when ? formatRelative(when) : '';

    return (
        <div className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-primary/40 hover:bg-card/60">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${pending
                        ? 'bg-muted/60 text-muted-foreground'
                        : isDraw
                          ? 'bg-muted text-muted-foreground'
                          : won
                            ? 'bg-green-500/15 text-green-500'
                            : 'bg-red-500/15 text-red-500'
                        }`}
                >
                    {pending ? '…' : isDraw ? 'D' : won ? 'W' : 'L'}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                        <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] uppercase"
                        >
                            <ModeIcon className="h-3 w-3" />
                            {meta.label}
                        </Badge>
                        <span className="truncate font-medium">
                            vs {opponent?.username ?? 'Unknown'}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {whenLabel}
                        {me && me.totalTests > 0 && (
                            <>
                                {' · '}
                                {me.testsPassed}/{me.totalTests} tests
                            </>
                        )}
                        {me?.language && <> · {me.language}</>}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {mmrChange != null && (
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold ${mmrChange > 0
                            ? 'bg-green-500/10 text-green-500'
                            : mmrChange < 0
                                ? 'bg-red-500/10 text-red-500'
                                : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        {mmrChange > 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                        ) : mmrChange < 0 ? (
                            <ArrowDownRight className="h-3 w-3" />
                        ) : (
                            <Minus className="h-3 w-3" />
                        )}
                        {mmrChange > 0 ? '+' : ''}
                        {mmrChange}
                    </span>
                )}
            </div>
        </div>
    );
}
