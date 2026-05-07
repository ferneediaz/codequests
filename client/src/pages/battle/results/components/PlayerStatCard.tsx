import { Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BattleParticipant } from '@/types/api';
import { formatSeconds } from '@/pages/battle/play/utils';
import { MmrCountUp } from './MmrCountUp';
import { RankUpFlash } from './RankUpFlash';

interface PlayerStatCardProps {
    player: BattleParticipant;
    isMe: boolean;
    isWinner: boolean;
    isDraw: boolean;
    battleStartedAt?: string;
}

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-0.5 text-sm font-mono">{value}</p>
        </div>
    );
}

function timeTakenSeconds(
    submittedAt: string | undefined,
    startedAt: string | undefined,
): number | null {
    if (!submittedAt || !startedAt) return null;
    return Math.max(
        0,
        Math.round(
            (new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000,
        ),
    );
}

export function PlayerStatCard({
    player,
    isMe,
    isWinner,
    isDraw,
    battleStartedAt,
}: PlayerStatCardProps) {
    const username = player.username || player.user?.username || 'Player';
    const seconds = timeTakenSeconds(player.submittedAt, battleStartedAt);
    const timeValue = seconds != null ? formatSeconds(seconds) : '—';

    return (
        <Card
            className={
                isWinner
                    ? 'border-green-500/50'
                    : isDraw
                      ? 'border-border'
                      : 'border-red-500/30'
            }
        >
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <span className="flex flex-wrap items-center gap-2">
                        {username}
                        {player.user && (
                            <RankUpFlash
                                oldMmr={player.user.mmr - (player.mmrChange ?? 0)}
                                newMmr={player.user.mmr}
                                className="text-xs"
                            />
                        )}
                        {isMe && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                        )}
                    </span>
                    {isWinner && <Trophy className="h-5 w-5 text-yellow-500" />}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2">
                    <StatCell
                        label="Tests"
                        value={`${player.testsPassed}/${player.totalTests}`}
                    />
                    <StatCell label="Time" value={timeValue} />
                    <StatCell label="Language" value={player.language ?? '—'} />
                    <StatCell
                        label="MMR"
                        value={
                            player.mmrChange != null && player.user ? (
                                <span
                                    className={
                                        player.mmrChange >= 0
                                            ? 'text-green-500'
                                            : 'text-red-500'
                                    }
                                >
                                    <MmrCountUp
                                        from={0}
                                        to={player.mmrChange}
                                        formatSign
                                    />
                                </span>
                            ) : (
                                '—'
                            )
                        }
                    />
                </div>
            </CardContent>
        </Card>
    );
}
