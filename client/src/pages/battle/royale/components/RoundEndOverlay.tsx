import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BattleParticipant, BattleRoyaleRoundEndPayload } from '@/types/api';

interface RoundEndOverlayProps {
    roundEnd: BattleRoyaleRoundEndPayload | null;
    participants: BattleParticipant[];
    onDone?: () => void;
}

export function RoundEndOverlay({
    roundEnd,
    participants,
    onDone,
}: RoundEndOverlayProps) {
    const [secondsLeft, setSecondsLeft] = useState(3);

    useEffect(() => {
        if (!roundEnd) return;
        const interval = setInterval(() => {
            setSecondsLeft((value) => {
                if (value <= 1) {
                    clearInterval(interval);
                    onDone?.();
                    return 0;
                }
                return value - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [onDone, roundEnd]);

    if (!roundEnd) return null;

    const eliminated = roundEnd.eliminatedUserIds.map((userId) => {
        const participant = participants.find((p) => p.userId === userId);
        return participant?.username ?? participant?.user?.username ?? userId;
    });

    return (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-md border-red-500/30">
                <CardContent className="space-y-4 p-6 text-center">
                    <Badge variant="outline" className="border-red-500/30 text-red-500">
                        Round {roundEnd.roundNumber} ended
                    </Badge>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            {eliminated.length === 1
                                ? '1 player eliminated'
                                : `${eliminated.length} players eliminated`}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Next round starts in {secondsLeft}s
                        </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        {eliminated.map((name) => (
                            <span
                                key={name}
                                className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm font-medium text-red-500"
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
