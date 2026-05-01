import { AnimateIn } from '@/components/layout/AnimateIn';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from './StatCard';

export function StatTile({
    label,
    value,
    icon,
    accent,
    accentBg,
    loading,
    footer,
    delay = 0,
}: {
    label: string;
    value: React.ReactNode;
    icon: React.ReactNode;
    accent: string;
    accentBg: string;
    loading?: boolean;
    footer?: string;
    delay?: number;
}) {
    return (
        <AnimateIn delay={delay} direction="up">
            <StatCard>
                <div className="flex items-start justify-between px-5">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                        </p>
                        {loading ? (
                            <Skeleton className="mt-2 h-8 w-16" />
                        ) : (
                            <p className="mt-1 text-3xl font-extrabold tracking-tight">
                                {value}
                            </p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground min-h-[1rem]">
                            {footer || '\u00A0'}
                        </p>
                    </div>
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accentBg} ${accent} transition-transform group-hover:scale-110`}
                    >
                        {icon}
                    </div>
                </div>
            </StatCard>
        </AnimateIn>
    );
}
