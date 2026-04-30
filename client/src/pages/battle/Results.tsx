import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RankBadge } from '@/components/ui/RankBadge';
import { CodeEditor } from '@/components/battle/CodeEditor';
import { Loader2, ArrowLeft, Trophy } from 'lucide-react';
import api from '@/services/api';
import type { BattleResponse, BattleParticipant } from '@/types/api';

function participantName(p: BattleParticipant) {
    return p.username || p.user?.username || 'Player';
}

export default function Results() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const userId = useAppSelector((state) => state.auth.user?.id);
    const [battle, setBattle] = useState<BattleResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const { data } = await api.get<BattleResponse>(`/battles/${id}`);
                setBattle(data);
            } catch (error) {
                console.error('Failed to load battle results:', error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id]);

    if (loading || !battle) {
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

    return (
        <div className="mx-auto max-w-5xl px-4 py-8">
            {/* Result header */}
            <div className="mb-8 text-center">
                {isDraw ? (
                    <h1 className="text-3xl font-bold text-muted-foreground">Draw</h1>
                ) : iWon ? (
                    <div>
                        <Trophy className="mx-auto mb-2 h-12 w-12 text-yellow-500" />
                        <h1 className="text-3xl font-bold text-green-500">Victory!</h1>
                    </div>
                ) : (
                    <h1 className="text-3xl font-bold text-red-500">Defeat</h1>
                )}
            </div>

            {/* Player cards */}
            <div className="mb-8 grid gap-4 md:grid-cols-2">
                {[me, opponent].map((player) => {
                    if (!player) return null;
                    const isWinner = battle.winnerId === player.userId;
                    const isMe = player.userId === userId;

                    return (
                        <Card
                            key={player.userId}
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
                                        {participantName(player)}
                                        {player.user && (
                                            <RankBadge
                                                mmr={player.user.mmr}
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
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tests Passed</span>
                                        <span className="font-mono">
                                            {player.testsPassed}/{player.totalTests}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Language</span>
                                        <span>{player.language ?? 'N/A'}</span>
                                    </div>
                                    {player.mmrChange != null && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">MMR Change</span>
                                            <span
                                                className={`font-semibold ${player.mmrChange >= 0 ? 'text-green-500' : 'text-red-500'
                                                    }`}
                                            >
                                                {player.mmrChange >= 0 ? '+' : ''}
                                                {player.mmrChange}
                                            </span>
                                        </div>
                                    )}
                                    {player.submittedAt && battle.startedAt && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Time</span>
                                            <span className="font-mono">
                                                {Math.round(
                                                    (new Date(player.submittedAt).getTime() -
                                                        new Date(battle.startedAt).getTime()) /
                                                    1000,
                                                )}
                                                s
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
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
                                <CodeEditor
                                    language={player.language ?? 'javascript'}
                                    onLanguageChange={() => { }}
                                    code={player.code ?? '// No code submitted'}
                                    onCodeChange={() => { }}
                                    starterCode="{}"
                                    readOnly
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center">
                <Button onClick={() => navigate('/dashboard')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </div>
        </div>
    );
}
