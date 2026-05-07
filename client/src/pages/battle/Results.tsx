import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RankBadge } from '@/components/ui/RankBadge';
import { CodeEditor } from '@/components/battle/CodeEditor';
import { BattleChat } from '@/components/battle/BattleChat';
import { Loader2, ArrowLeft, Trophy, RotateCcw } from 'lucide-react';
import { battlesApi } from '@/services/battles';
import { queryKeys } from '@/lib/queryKeys';
import type {
    BattleParticipant,
    BattleRoundEndReason,
    BattleRoundStatus,
} from '@/types/api';
import { formatSeconds } from '@/pages/battle/play/utils';
import { ResultHeader } from '@/pages/battle/results/components/ResultHeader';
import { PlayerStatCard } from '@/pages/battle/results/components/PlayerStatCard';
import { toast } from 'sonner';

function participantName(p: BattleParticipant) {
    return p.username || p.user?.username || 'Player';
}

export default function Results() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const [rematching, setRematching] = useState(false);

    const battleQuery = useQuery({
        queryKey: queryKeys.battle(id ?? ''),
        queryFn: () => battlesApi.getBattle(id as string),
        enabled: !!id,
    });
    const battle = battleQuery.data;
    const isBattleRoyale = battle?.mode === 'BATTLE_ROYALE';

    const roundsQuery = useQuery({
        queryKey: queryKeys.battleRounds(id ?? ''),
        queryFn: () => battlesApi.listRounds(id as string),
        enabled: !!id && isBattleRoyale,
    });
    const standingsQuery = useQuery({
        queryKey: queryKeys.battleStandings(id ?? ''),
        queryFn: () => battlesApi.getStandings(id as string),
        enabled: !!id && isBattleRoyale,
    });
    const royaleRounds = roundsQuery.data ?? [];
    const royaleStandings = standingsQuery.data?.standings ?? [];

    if (battleQuery.isLoading || !battle) {
        return (
            <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const me = battle.participants.find((p) => p.userId === userId);
    const opponent = battle.participants.find((p) => p.userId !== userId);
    const iWon = battle.winnerId === userId;
    const isDraw = battle.status === 'COMPLETED' && !battle.winnerId;
    const canRematch = ['ONE_V_ONE', 'GROUP', 'CLAN_VS_CLAN'].includes(battle.mode);

    if (battle.mode === 'BATTLE_ROYALE') {
        const byPlacement = [...royaleStandings].sort((a, b) => {
            const aPlacement = a.placement ?? Number.MAX_SAFE_INTEGER;
            const bPlacement = b.placement ?? Number.MAX_SAFE_INTEGER;
            return aPlacement - bPlacement;
        });
        const podium = byPlacement.slice(0, 3);

        return (
            <div className="mx-auto max-w-6xl px-4 py-8">
                <div className="mb-8 text-center">
                    <Trophy className="mx-auto mb-2 h-12 w-12 text-yellow-500" />
                    <h1 className="text-3xl font-bold text-foreground">
                        Battle Royale Complete
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Champion crowned after {royaleRounds.length} rounds
                    </p>
                </div>

                <div className="mb-8 grid gap-4 md:grid-cols-3">
                    {podium.map((entry, index) => {
                        const participant = battle.participants.find(
                            (p) => p.userId === entry.userId,
                        );
                        const place = entry.placement ?? index + 1;
                        return (
                            <Card
                                key={entry.userId}
                                className={
                                    place === 1
                                        ? 'border-yellow-500/50'
                                        : place === 2
                                          ? 'border-slate-400/50'
                                          : 'border-amber-700/50'
                                }
                            >
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>{placeLabel(place)}</span>
                                        {place === 1 && (
                                            <Trophy className="h-5 w-5 text-yellow-500" />
                                        )}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 text-center">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-bold">
                                        {(entry.username ?? entry.userId)
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-semibold">
                                            {entry.username ?? entry.userId}
                                            {entry.userId === userId && (
                                                <span className="ml-1 text-xs text-muted-foreground">
                                                    (you)
                                                </span>
                                            )}
                                        </p>
                                        {participant?.user && (
                                            <RankBadge
                                                mmr={participant.user.mmr}
                                                className="mt-1 text-xs"
                                            />
                                        )}
                                    </div>
                                    {participant?.mmrChange != null && (
                                        <p
                                            className={`font-mono font-semibold ${
                                                participant.mmrChange >= 0
                                                    ? 'text-green-500'
                                                    : 'text-red-500'
                                            }`}
                                        >
                                            {participant.mmrChange >= 0 ? '+' : ''}
                                            {participant.mmrChange} MMR
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Round Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-muted-foreground">
                                    <tr className="border-b border-border">
                                        <th className="py-2 pr-4">Round</th>
                                        <th className="py-2 pr-4">Status</th>
                                        <th className="py-2 pr-4">Time</th>
                                        <th className="py-2 pr-4">Eliminations</th>
                                        <th className="py-2">Ended</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {royaleRounds.map((round) => (
                                        <tr
                                            key={round.id}
                                            className="border-b border-border/60"
                                        >
                                            <td className="py-2 pr-4 font-medium">
                                                {round.roundNumber}
                                            </td>
                                            <td className="py-2 pr-4">
                                                {roundStatusLabel(round.status)}
                                            </td>
                                            <td className="py-2 pr-4 font-mono">
                                                {formatSeconds(round.timeLimitSeconds)}
                                            </td>
                                            <td className="py-2 pr-4">
                                                {round.eliminateCount}
                                            </td>
                                            <td className="py-2">
                                                {roundEndReasonLabel(round.endedReason)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-center">
                    <Button onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </div>
                {userId && (
                    <BattleChat
                        battleId={battle.id}
                        currentUserId={userId}
                        mode="postgame"
                    />
                )}
            </div>
        );
    }

    const createRematch = async () => {
        setRematching(true);
        try {
            const rematch = await battlesApi.createRematch(battle.id);
            toast.success('Rematch created.');
            navigate(`/battle/${rematch.id}`);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Could not create rematch.';
            toast.error(message);
        } finally {
            setRematching(false);
        }
    };

    const myMmrDelta = me?.mmrChange;

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            <ResultHeader
                outcome={isDraw ? 'draw' : iWon ? 'win' : 'loss'}
                mmrDelta={isDraw ? null : (myMmrDelta ?? null)}
            />
            {/* TODO(2.3): render WinStreakBadge once server exposes participant.user.currentWinStreak */}

            {/* Player cards */}
            <div className="mb-8 grid gap-4 md:grid-cols-2">
                {[me, opponent].map((player) => {
                    if (!player) return null;
                    return (
                        <PlayerStatCard
                            key={player.userId}
                            player={player}
                            isMe={player.userId === userId}
                            isWinner={battle.winnerId === player.userId}
                            isDraw={isDraw}
                            battleStartedAt={battle.startedAt}
                        />
                    );
                })}
            </div>

            <Separator className="mb-8" />

            {/* Code comparison */}
            <h2 className="mb-4 text-lg font-semibold text-foreground">Code Comparison</h2>
            <div className="mb-8 grid gap-4 md:grid-cols-2">
                {[me, opponent].map((player) => {
                    if (!player) return null;
                    return (
                        <div key={player.userId}>
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>
                                    {participantName(player)}
                                    {player.userId === userId && ' (you)'}
                                    {player.language && ` — ${player.language}`}
                                </span>
                                {player.user && (
                                    <RankBadge
                                        mmr={player.user.mmr}
                                        className="text-[11px]"
                                    />
                                )}
                            </div>
                            <div className="h-80 overflow-hidden rounded-lg border border-border">
                                {player.code ? (
                                    <CodeEditor
                                        language={player.language ?? 'javascript'}
                                        onLanguageChange={() => { }}
                                        code={player.code}
                                        onCodeChange={() => { }}
                                        starterCode="{}"
                                        readOnly
                                    />
                                ) : (
                                    <div className="flex h-full items-center justify-center bg-muted/20">
                                        <p className="text-sm text-muted-foreground">
                                            No code submitted
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center gap-3">
                <Button onClick={() => navigate('/dashboard')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
                {canRematch && (
                    <Button
                        variant="secondary"
                        onClick={() => void createRematch()}
                        disabled={rematching}
                    >
                        {rematching ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RotateCcw className="mr-2 h-4 w-4" />
                        )}
                        Rematch
                    </Button>
                )}
            </div>
            {userId && (
                <BattleChat
                    battleId={battle.id}
                    currentUserId={userId}
                    mode="postgame"
                />
            )}
        </div>
    );
}

function placeLabel(place: number) {
    if (place === 1) return '1st Place';
    if (place === 2) return '2nd Place';
    if (place === 3) return '3rd Place';
    return `${place}th Place`;
}

function roundStatusLabel(status: BattleRoundStatus): string {
    switch (status) {
        case 'PENDING':
            return 'Pending';
        case 'IN_PROGRESS':
            return 'In Progress';
        case 'COMPLETED':
            return 'Completed';
        default:
            return status;
    }
}

function roundEndReasonLabel(reason?: BattleRoundEndReason | null): string {
    switch (reason) {
        case 'EARLY_ALL_PASSED':
            return 'Solved early';
        case 'TIMER':
            return 'Timer expired';
        case 'NO_PLAYERS':
            return 'No players left';
        default:
            return '—';
    }
}
