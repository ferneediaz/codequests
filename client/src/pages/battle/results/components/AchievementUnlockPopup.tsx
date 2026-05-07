import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { DynamicIcon } from '@/components/achievements/DynamicIcon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AchievementUnlockedPayload } from '@/types/socket';
import { prefersReducedMotion } from './confettiBursts';
import { AchievementShareMenu } from './AchievementShareMenu';

interface AchievementUnlockPopupProps {
    achievement: AchievementUnlockedPayload;
    queueRemaining: number;
    onDismiss: () => void;
}

const TIER_CLASSES: Record<string, { ring: string; bg: string; icon: string }> = {
    bronze: {
        ring: 'border-amber-700/60',
        bg: 'bg-amber-700/10',
        icon: 'text-amber-500',
    },
    silver: {
        ring: 'border-zinc-300/70',
        bg: 'bg-zinc-300/10',
        icon: 'text-zinc-200',
    },
    gold: {
        ring: 'border-yellow-400/70',
        bg: 'bg-yellow-400/10',
        icon: 'text-yellow-300',
    },
};

const TIER_GLOW: Record<string, string> = {
    bronze: '#b45309',
    silver: '#d4d4d8',
    gold: '#facc15',
};

const AUTO_ADVANCE_MS = 4500;

export function AchievementUnlockPopup({
    achievement,
    queueRemaining,
    onDismiss,
}: AchievementUnlockPopupProps) {
    const [reducedMotion] = useState(() => prefersReducedMotion());
    const [phase, setPhase] = useState<'flash' | 'settled'>(
        reducedMotion ? 'settled' : 'flash',
    );
    const [shareOpen, setShareOpen] = useState(false);
    const tier = TIER_CLASSES[achievement.tier] ?? TIER_CLASSES.bronze;
    const glow = TIER_GLOW[achievement.tier] ?? TIER_GLOW.bronze;

    useEffect(() => {
        if (reducedMotion) return;
        const id = window.setTimeout(() => setPhase('settled'), 600);
        return () => window.clearTimeout(id);
    }, [reducedMotion]);

    useEffect(() => {
        if (shareOpen) return;
        const id = window.setTimeout(onDismiss, AUTO_ADVANCE_MS);
        return () => window.clearTimeout(id);
    }, [shareOpen, onDismiss, achievement.achievementId]);

    const badgeStyle =
        phase === 'flash'
            ? {
                  transform: 'scale(1.1)',
                  filter: `drop-shadow(0 0 16px ${glow}) drop-shadow(0 0 28px ${glow})`,
                  transition:
                      'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), filter 600ms ease-out',
              }
            : {
                  transform: 'scale(1)',
                  filter: `drop-shadow(0 0 10px ${glow})`,
                  transition:
                      'transform 400ms cubic-bezier(0.22, 1, 0.36, 1), filter 400ms ease-out',
              };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievement-popup-title"
        >
            <div
                className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                onClick={onDismiss}
            />

            <div
                className={cn(
                    'relative z-10 w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-2xl',
                    tier.ring,
                    reducedMotion ? '' : 'animate-in fade-in zoom-in-95',
                )}
                data-testid="achievement-unlock-popup"
                data-achievement-id={achievement.achievementId}
            >
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>

                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Achievement unlocked
                </p>

                <div className="mt-5 flex justify-center">
                    <div
                        className={cn(
                            'flex h-24 w-24 items-center justify-center rounded-2xl border-2',
                            tier.ring,
                            tier.bg,
                        )}
                        style={badgeStyle}
                    >
                        <DynamicIcon
                            name={achievement.icon}
                            className={cn('h-12 w-12', tier.icon)}
                        />
                    </div>
                </div>

                <h2
                    id="achievement-popup-title"
                    className="mt-5 text-2xl font-bold tracking-tight"
                >
                    {achievement.title}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    {achievement.description}
                </p>

                <div className="mt-6 flex flex-col items-center gap-3">
                    <AchievementShareMenu
                        achievement={achievement}
                        open={shareOpen}
                        onOpenChange={setShareOpen}
                    />
                    <Button variant="ghost" size="sm" onClick={onDismiss}>
                        {queueRemaining > 0
                            ? `Continue (${queueRemaining} more)`
                            : 'Continue'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
