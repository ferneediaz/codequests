import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { HeatmapData } from '@/utils/stats';
import { Heatmap } from './Heatmap';

interface HeatmapCardProps {
    data: HeatmapData;
    isLoading?: boolean;
    /** Card title; defaults to "Activity heatmap". */
    title?: string;
    /**
     * Right-aligned slot in the header — typically the year selector
     * on Dashboard. Profile leaves this empty.
     */
    headerExtra?: ReactNode;
    /**
     * Secondary line under the title. Defaults to a subtle subtitle
     * combining the period label and the GitHub login (when set).
     * Pass your own node to override (e.g. Dashboard's stats line).
     */
    subtitle?: ReactNode;
    /** GitHub login appended to the default subtitle. */
    githubUsername?: string | null;
}

/**
 * Shared activity-heatmap section used by Dashboard and the public
 * profile page. Always renders the title row + Heatmap; consumers add
 * stats / year selectors via the `headerExtra` and `subtitle` slots.
 */
export function HeatmapCard({
    data,
    isLoading = false,
    title = 'Activity heatmap',
    headerExtra,
    subtitle,
    githubUsername,
}: HeatmapCardProps) {
    const defaultSubtitle = (
        <span className="text-xs text-muted-foreground">
            {data.periodLabel}
            {githubUsername ? ` · GitHub: @${githubUsername}` : ''}
        </span>
    );

    return (
        <Card className="h-full">
            <CardContent className="p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="inline-flex items-center gap-2 text-base font-semibold">
                            <Activity className="h-4 w-4 text-primary" />
                            {title}
                        </h2>
                        <div className="mt-1">{subtitle ?? defaultSubtitle}</div>
                    </div>
                    {headerExtra && (
                        <div className="flex shrink-0 items-center gap-2">
                            {headerExtra}
                        </div>
                    )}
                </div>
                {isLoading ? (
                    <Skeleton className="h-[120px] w-full" />
                ) : (
                    <Heatmap
                        grid={data.grid}
                        dates={data.dates}
                        breakdown={data.breakdown}
                        monthLabels={data.monthLabels}
                        max={data.max}
                    />
                )}
            </CardContent>
        </Card>
    );
}
