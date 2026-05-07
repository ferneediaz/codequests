import type { Achievement } from '@/types/achievement';
import { cn } from '@/lib/utils';
import { DynamicIcon } from './DynamicIcon';

interface AchievementBadgeProps {
    achievement: Achievement;
}

const TIER_STYLES: Record<
    Achievement['tier'],
    { ring: string; bg: string; icon: string }
> = {
    bronze: {
        ring: 'border-amber-700/50',
        bg: 'bg-amber-700/10',
        icon: 'text-amber-500',
    },
    silver: {
        ring: 'border-zinc-300/60',
        bg: 'bg-zinc-300/10',
        icon: 'text-zinc-200',
    },
    gold: {
        ring: 'border-yellow-400/60',
        bg: 'bg-yellow-400/10',
        icon: 'text-yellow-300',
    },
};

const formatDate = (iso: string) => {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return '';
    }
};

export function AchievementBadge({ achievement }: AchievementBadgeProps) {
    const tier = TIER_STYLES[achievement.tier];
    const isLocked = !achievement.unlocked;

    return (
        <div
            className="group relative flex flex-col items-center"
            data-testid={`achievement-badge-${achievement.id}`}
            data-locked={isLocked ? 'true' : 'false'}
        >
            <div
                className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all',
                    isLocked
                        ? 'border-border/50 bg-muted/30 grayscale'
                        : `${tier.ring} ${tier.bg}`,
                )}
            >
                <DynamicIcon
                    name={achievement.icon}
                    className={cn(
                        'h-7 w-7 transition-colors',
                        isLocked ? 'text-muted-foreground/40' : tier.icon,
                    )}
                />
            </div>
            <p
                className={cn(
                    'mt-1 line-clamp-1 max-w-full text-center text-[10px] font-medium',
                    isLocked
                        ? 'text-muted-foreground/60'
                        : 'text-foreground',
                )}
            >
                {achievement.title}
            </p>

            {/* Tooltip — same CSS group-hover pattern used by SkillBar */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-44 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <div className="font-semibold">{achievement.title}</div>
                    <div className="mt-0.5 text-muted-foreground">
                        {achievement.description}
                    </div>
                    {isLocked ? (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            Locked
                        </div>
                    ) : achievement.unlockedAt ? (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-emerald-400">
                            Unlocked {formatDate(achievement.unlockedAt)}
                        </div>
                    ) : (
                        <div className="mt-1 text-[10px] uppercase tracking-wide text-emerald-400">
                            Unlocked
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
