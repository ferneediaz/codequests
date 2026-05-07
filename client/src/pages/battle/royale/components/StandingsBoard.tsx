import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RankBadge } from '@/components/ui/RankBadge';
import { Trophy } from 'lucide-react';
import type { BattleRoyaleFormat, BattleRoyaleStandingsEntry } from '@/types/api';

interface StandingsBoardProps {
    standings: BattleRoyaleStandingsEntry[];
    format: BattleRoyaleFormat;
    currentUserId?: string;
}

export function StandingsBoard({
    standings,
    format,
    currentUserId,
}: StandingsBoardProps) {
    return (
        <Card className="flex h-full flex-col overflow-hidden">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    <span>Live Standings</span>
                    <Badge variant="outline">
                        {format === 'SCORE_ATTACK' ? 'Score Attack' : 'Same Problem'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-2 overflow-y-auto pb-4">
                {standings.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                        Standings will appear after the round starts.
                    </p>
                ) : (
                    standings.map((entry, index) => {
                        const isMe = entry.userId === currentUserId;
                        const rank = entry.placement ?? index + 1;
                        return (
                            <div
                                key={entry.userId}
                                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                                    entry.isEliminated
                                        ? 'border-red-500/20 bg-red-500/5 opacity-60'
                                        : isMe
                                          ? 'border-primary/50 bg-primary/10'
                                          : 'border-border bg-card'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                            {rank}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1">
                                                <span className="truncate font-medium">
                                                    {entry.username ?? entry.userId}
                                                </span>
                                                {isMe && (
                                                    <span className="text-xs text-muted-foreground">
                                                        (you)
                                                    </span>
                                                )}
                                                {index === 0 && !entry.isEliminated && (
                                                    <Trophy className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                                )}
                                            </div>
                                            {entry.mmr != null && (
                                                <RankBadge
                                                    mmr={entry.mmr}
                                                    className="text-[10px]"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    {entry.isEliminated ? (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-red-500/30 text-red-500"
                                        >
                                            Out R{entry.eliminatedInRound ?? '?'}
                                        </Badge>
                                    ) : format === 'SCORE_ATTACK' ? (
                                        <div className="shrink-0 text-right">
                                            <p className="font-mono font-semibold">
                                                {entry.cumulativePoints} pts
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                +{entry.roundPoints} this round
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="shrink-0 font-mono font-semibold">
                                            {entry.testsPassed}/{entry.totalTests}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
