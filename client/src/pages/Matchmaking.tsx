import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { useAppDispatch } from '@/store/hooks';
import { resetQueue } from '@/store/slices/matchmakingSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, X } from 'lucide-react';
import type { MatchConfig } from '@/types/api';

export default function Matchmaking() {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { joinQueue, leaveQueue } = useMatchmaking();
    const joinedRef = useRef(false);

    const config = (location.state as { config?: MatchConfig })?.config;

    useEffect(() => {
        if (!joinedRef.current) {
            joinedRef.current = true;
            dispatch(resetQueue());
            joinQueue(config).catch(() => {
                navigate('/play');
            });
        }
    }, [dispatch, joinQueue, navigate, config]);

    const handleCancel = async () => {
        await leaveQueue();
        navigate('/play');
    };

    return (
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardContent className="flex flex-col items-center gap-6 pt-8 pb-8">
                    <div className="relative">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                        <div className="absolute -inset-2 animate-ping rounded-full border border-primary/20" />
                    </div>

                    <div className="text-center">
                        <h2 className="mb-1 text-xl font-semibold text-foreground">
                            Searching for opponent...
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Finding a player near your skill level
                        </p>
                    </div>

                    {/* Show config summary while queuing */}
                    {config && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Badge variant="secondary">
                                {config.mode === 'ONE_V_ONE'
                                    ? '1v1'
                                    : config.mode === 'BATTLE_ROYALE'
                                      ? 'Battle Royale'
                                      : 'Group'}
                            </Badge>
                            {config.preferredDifficulty && (
                                <Badge variant="outline">{config.preferredDifficulty}</Badge>
                            )}
                            <Badge variant="outline">{config.timeLimitMinutes} min</Badge>
                            {config.preferredTopic && (
                                <Badge variant="outline">{config.preferredTopic}</Badge>
                            )}
                            {config.enabledSkills.length > 0 && (
                                <Badge variant="outline">
                                    {config.enabledSkills.length} skill{config.enabledSkills.length > 1 ? 's' : ''}
                                </Badge>
                            )}
                        </div>
                    )}

                    <Button variant="outline" onClick={handleCancel}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
