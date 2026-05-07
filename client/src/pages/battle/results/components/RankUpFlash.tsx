import { useEffect, useState } from 'react';
import { RankBadge } from '@/components/ui/RankBadge';
import { getRankTier } from '@/utils/rank';

interface RankUpFlashProps {
    oldMmr: number;
    newMmr: number;
    className?: string;
}

type Phase = 'old' | 'flash' | 'new';

const detectReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function RankUpFlash({ oldMmr, newMmr, className }: RankUpFlashProps) {
    const oldTier = getRankTier(oldMmr);
    const newTier = getRankTier(newMmr);
    const isRankUp = oldTier.name !== newTier.name;

    const [prefersReducedMotion] = useState(detectReducedMotion);
    const [phase, setPhase] = useState<Phase>(
        !isRankUp || prefersReducedMotion ? 'new' : 'old',
    );

    useEffect(() => {
        if (!isRankUp || prefersReducedMotion) return;

        const flashTimer = window.setTimeout(() => setPhase('flash'), 600);
        const newTimer = window.setTimeout(() => setPhase('new'), 900);
        return () => {
            window.clearTimeout(flashTimer);
            window.clearTimeout(newTimer);
        };
    }, [isRankUp, prefersReducedMotion]);

    if (!isRankUp) {
        return <RankBadge mmr={newMmr} className={className} />;
    }

    const displayMmr = phase === 'old' ? oldMmr : newMmr;
    const isFlash = phase === 'flash';
    const isNew = phase === 'new';

    return (
        <span
            className={`inline-flex items-center transition-all duration-300 ${
                isFlash ? 'scale-125' : 'scale-100'
            } ${className ?? ''}`}
            style={
                isNew
                    ? { filter: `drop-shadow(0 0 8px ${newTier.color})` }
                    : isFlash
                      ? { filter: `drop-shadow(0 0 14px ${newTier.color})` }
                      : undefined
            }
        >
            <RankBadge mmr={displayMmr} />
        </span>
    );
}
