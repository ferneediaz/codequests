import { Trophy } from 'lucide-react';
import type { Achievement } from '@/types/achievement';
import { Skeleton } from '@/components/ui/skeleton';
import { AchievementBadge } from './AchievementBadge';

interface AchievementsGridProps {
    achievements: Achievement[];
    isLoading?: boolean;
    /** Heading text; defaults to "Achievements". Hidden when null. */
    title?: string | null;
}

export function AchievementsGrid({
    achievements,
    isLoading = false,
    title = 'Achievements',
}: AchievementsGridProps) {
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const total = achievements.length;

    if (isLoading) {
        return (
            <div>
                {title !== null && (
                    <div className="mb-3 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">{title}</h3>
                    </div>
                )}
                <div
                    className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-7"
                    data-testid="achievements-grid-loading"
                >
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className="aspect-square h-14 w-14 rounded-xl"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            {title !== null && (
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">{title}</h3>
                    </div>
                    <span
                        className="text-xs font-mono text-muted-foreground"
                        data-testid="achievements-counter"
                    >
                        {unlockedCount} / {total} unlocked
                    </span>
                </div>
            )}
            {total === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No achievements yet.
                </p>
            ) : (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-7">
                    {achievements.map((a) => (
                        <AchievementBadge key={a.id} achievement={a} />
                    ))}
                </div>
            )}
        </div>
    );
}
