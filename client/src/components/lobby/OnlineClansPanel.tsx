import { useNavigate } from 'react-router-dom';
import { Shield, Users, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LobbyClan } from '@/types/lobby';

interface OnlineClansPanelProps {
    clans: LobbyClan[];
}

/**
 * Render clans that currently have at least one online member, sorted by
 * online count then MMR. Clicking a clan card routes to the clans page
 * (clan challenges are initiated there today).
 */
export function OnlineClansPanel({ clans }: OnlineClansPanelProps) {
    const navigate = useNavigate();

    return (
        <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardContent className="flex h-full min-h-0 flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide">
                        Active Clans
                    </h3>
                    <Badge variant="secondary">{clans.length}</Badge>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {clans.length === 0 ? (
                        <div className="flex h-full items-center justify-center py-6 text-center text-xs text-muted-foreground">
                            No clans have members online right now.
                        </div>
                    ) : (
                        clans.map((clan) => (
                            <button
                                key={clan.id}
                                type="button"
                                onClick={() => navigate('/clan')}
                                className="group flex w-full items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2 text-left hover:border-primary/40"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-medium">
                                            {clan.name}
                                        </span>
                                        <span className="text-[10px] font-semibold text-muted-foreground">
                                            [{clan.tag}]
                                        </span>
                                    </div>
                                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            {clan.memberCount} members
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Flame className="h-3 w-3 text-orange-400" />
                                            {clan.mmr} MMR
                                        </span>
                                    </div>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className="shrink-0 text-[10px]"
                                >
                                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    {clan.onlineCount} online
                                </Badge>
                            </button>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
