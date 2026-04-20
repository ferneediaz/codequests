import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, X } from 'lucide-react';

export default function Matchmaking() {
    const navigate = useNavigate();
    const { queueStatus, joinQueue, leaveQueue } = useMatchmaking();

    useEffect(() => {
        if (queueStatus === 'idle') {
            joinQueue().catch(() => {
                navigate('/dashboard');
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCancel = async () => {
        await leaveQueue();
        navigate('/dashboard');
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

                    <Button variant="outline" onClick={handleCancel}>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
