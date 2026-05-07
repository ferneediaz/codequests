import { Badge } from '@/components/ui/badge';
import { Crown, Users } from 'lucide-react';

interface RoundIndicatorProps {
    currentRound: number;
    totalRounds: number;
    remainingCount: number;
    eliminateCount: number;
    isFinalRound: boolean;
}

export function RoundIndicator({
    currentRound,
    totalRounds,
    remainingCount,
    eliminateCount,
    isFinalRound,
}: RoundIndicatorProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge
                variant={isFinalRound ? 'default' : 'secondary'}
                className="gap-1.5 px-3 py-1 text-sm"
            >
                <Crown className="h-3.5 w-3.5" />
                {isFinalRound
                    ? 'Final Round'
                    : `Round ${currentRound || 1} of ${totalRounds || '?'}`}
            </Badge>
            <Badge variant="outline" className="gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {remainingCount} remaining
            </Badge>
            {!isFinalRound && (
                <Badge variant="outline" className="border-red-500/30 text-red-500">
                    {eliminateCount} out
                </Badge>
            )}
        </div>
    );
}
