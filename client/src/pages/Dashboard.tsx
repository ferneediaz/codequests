import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RankBadge } from '@/components/ui/RankBadge';
import { Swords, Trophy, TrendingDown } from 'lucide-react';
import api from '@/services/api';
import type { UserStats, MatchHistoryEntry } from '@/types/api';

export default function Dashboard() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);

    const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
        queryKey: ['userStats', user?.id],
        queryFn: async () => {
            const { data } = await api.get(`/users/${user!.id}/stats`);
            return data;
        },
        enabled: !!user?.id,
    });

    const { data: history, isLoading: historyLoading } = useQuery<MatchHistoryEntry[]>({
        queryKey: ['matchHistory', user?.id],
        queryFn: async () => {
            const { data } = await api.get(`/users/${user!.id}/history`, {
                params: { limit: 5 },
            });
            return data;
        },
        enabled: !!user?.id,
    });

    return (
        <div className="mx-auto max-w-4xl px-4 py-8">
            {/* Find Match CTA */}
            <div className="mb-8 text-center">
                <h1 className="mb-4 text-3xl font-bold text-foreground">Ready to Battle?</h1>
                <Button
                    size="lg"
                    className="h-14 px-12 text-lg"
                    onClick={() => navigate('/play')}
                >
                    <Swords className="mr-2 h-5 w-5" />
                    Play
                </Button>
            </div>

            {/* Stats */}
            <div className="mb-8 grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Rank</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-32" />
                        ) : (
                            <RankBadge mmr={stats?.mmr ?? user?.mmr ?? 1000} showMmr />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Wins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-green-500" />
                                <span className="text-2xl font-bold">{stats?.wins ?? 0}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground">Losses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? (
                            <Skeleton className="h-8 w-16" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <TrendingDown className="h-5 w-5 text-red-500" />
                                <span className="text-2xl font-bold">{stats?.losses ?? 0}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Matches */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Matches</CardTitle>
                </CardHeader>
                <CardContent>
                    {historyLoading ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : !history?.length ? (
                        <p className="text-center text-muted-foreground py-4">
                            No matches yet. Start your first battle!
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {history.map((match) => {
                                const myParticipant = match.participants.find(
                                    (p) => p.userId === user?.id,
                                );
                                const opponent = match.participants.find(
                                    (p) => p.userId !== user?.id,
                                );
                                const won = match.winnerId === user?.id;
                                const isDraw = match.status === 'COMPLETED' && !match.winnerId;

                                return (
                                    <div
                                        key={match.id}
                                        className="flex items-center justify-between rounded-lg border border-border p-3"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${isDraw
                                                    ? 'bg-muted text-muted-foreground'
                                                    : won
                                                        ? 'bg-green-500/20 text-green-500'
                                                        : 'bg-red-500/20 text-red-500'
                                                    }`}
                                            >
                                                {isDraw ? 'D' : won ? 'W' : 'L'}
                                            </span>
                                            <span className="text-sm">
                                                vs {opponent?.username ?? 'Unknown'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="text-muted-foreground">
                                                {myParticipant?.testsPassed}/{myParticipant?.totalTests} tests
                                            </span>
                                            {myParticipant?.mmrChange != null && (
                                                <span
                                                    className={
                                                        myParticipant.mmrChange >= 0
                                                            ? 'text-green-500'
                                                            : 'text-red-500'
                                                    }
                                                >
                                                    {myParticipant.mmrChange >= 0 ? '+' : ''}
                                                    {myParticipant.mmrChange}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
