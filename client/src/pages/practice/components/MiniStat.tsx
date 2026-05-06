import type { ReactNode } from 'react';

export function MiniStat({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-background/60 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                {label}
            </div>
            <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
        </div>
    );
}
