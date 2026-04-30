import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMatchmaking, type JoinQueueError } from '@/hooks/useMatchmaking';
import { useAppDispatch } from '@/store/hooks';
import { resetQueue } from '@/store/slices/matchmakingSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2, Play, X } from 'lucide-react';
import type { MatchConfig } from '@/types/api';

export default function Matchmaking() {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { joinQueue, leaveQueue } = useMatchmaking();
    const joinedRef = useRef(false);
    const [error, setError] = useState<JoinQueueError | null>(null);

    const config = (location.state as { config?: MatchConfig })?.config;

    useEffect(() => {
        if (!joinedRef.current) {
            joinedRef.current = true;
            dispatch(resetQueue());
            joinQueue(config).catch((err: unknown) => {
                // Surface the failure reason on this page instead of
                // silently bouncing the user back to /play. See
                // JoinQueueError in useMatchmaking for the shape.
                const typed =
                    err &&
                    typeof err === 'object' &&
                    'code' in (err as object)
                        ? (err as JoinQueueError)
                        : null;
                if (typed) {
                    setError(typed);
                } else {
                    setError({
                        name: 'JoinQueueError',
                        message:
                            (err as Error | undefined)?.message ??
                            'Could not join matchmaking. Please try again.',
                        code: 'GENERIC',
                    } as JoinQueueError);
                }
            });
        }
    }, [dispatch, joinQueue, config]);

    const handleCancel = async () => {
        await leaveQueue();
        navigate('/play');
    };

    const handleBackToPlay = () => {
        navigate('/play');
    };

    const handleResumeBattle = () => {
        if (error?.battleId) {
            navigate(`/battle/${error.battleId}`);
        }
    };

    if (error) {
        const isActiveBattle = error.code === 'ACTIVE_BATTLE' && !!error.battleId;
        const title = isActiveBattle
            ? 'You are already in a battle'
            : error.code === 'PAYWALL'
              ? 'Daily game limit reached'
              : "Couldn't start matchmaking";

        return (
            <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center gap-6 pt-8 pb-8">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-destructive/40 bg-destructive/10">
                            <AlertTriangle className="h-10 w-10 text-destructive" />
                        </div>

                        <div className="text-center">
                            <h2 className="mb-1 text-xl font-semibold text-foreground">
                                {title}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {error.message}
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                            {isActiveBattle && (
                                <Button onClick={handleResumeBattle}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Resume Battle
                                </Button>
                            )}
                            <Button variant="outline" onClick={handleBackToPlay}>
                                Back to Play
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

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
