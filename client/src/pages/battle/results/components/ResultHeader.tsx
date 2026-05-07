import { Trophy, Frown } from 'lucide-react';
import { MmrCountUp } from './MmrCountUp';
import { VictoryConfetti } from './VictoryConfetti';

type Outcome = 'win' | 'loss' | 'draw';

interface ResultHeaderProps {
    outcome: Outcome;
    mmrDelta: number | null;
}

export function ResultHeader({ outcome, mmrDelta }: ResultHeaderProps) {
    if (outcome === 'draw') {
        return (
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-muted-foreground">Draw</h1>
            </div>
        );
    }

    const isWin = outcome === 'win';

    return (
        <div className="mb-8 text-center">
            {isWin ? (
                <>
                    <VictoryConfetti />
                    <Trophy className="mx-auto mb-2 h-12 w-12 text-yellow-500" />
                    <h1 className="text-3xl font-bold text-green-500">Victory!</h1>
                </>
            ) : (
                <>
                    <Frown className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                    <h1 className="text-3xl font-bold text-red-500">Defeat</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Better luck next time.
                    </p>
                </>
            )}
            {mmrDelta != null && (
                <p
                    className={`mt-2 text-2xl font-mono font-semibold ${
                        mmrDelta >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}
                >
                    <MmrCountUp from={0} to={mmrDelta} formatSign />
                    <span className="ml-1">MMR</span>
                </p>
            )}
        </div>
    );
}
