import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getClanBattles } from '@/services/clans';

const PAGE_SIZE = 5;

export function ClanBattleHistory({ clanId }: { clanId: string }) {
    const [page, setPage] = useState(1);
    const query = useQuery({
        queryKey: ['clans', 'battle-history', clanId, page],
        queryFn: () => getClanBattles(clanId, { page, limit: PAGE_SIZE }),
    });
    const history = query.data;

    return (
        <div className="rounded-xl border border-border">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Battle History</h2>
            </div>
            <div className="space-y-3 p-4">
                {query.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading battles...</p>
                ) : !history || history.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clan battles yet.</p>
                ) : (
                    history.data.map((battle) => (
                        <div key={battle.id} className="rounded-lg border border-border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant={
                                            battle.clanResult === 'win'
                                                ? 'default'
                                                : battle.clanResult === 'loss'
                                                  ? 'destructive'
                                                  : 'secondary'
                                        }
                                    >
                                        {battle.clanResult.toUpperCase()}
                                    </Badge>
                                    <span className="text-sm font-medium">
                                        {battle.mode.replaceAll('_', ' ')}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {formatDate(battle.endedAt ?? battle.createdAt)}
                                </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                {battle.participants.length} participants
                                {battle.teamSize ? ` · ${battle.teamSize}v${battle.teamSize}` : ''}
                            </p>
                        </div>
                    ))
                )}
                {history && history.meta.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((value) => Math.max(1, value - 1))}
                        >
                            Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            Page {history.meta.page} of {history.meta.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= history.meta.totalPages}
                            onClick={() => setPage((value) => value + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'recently';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}
