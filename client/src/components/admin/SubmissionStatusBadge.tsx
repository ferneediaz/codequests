import { cn } from '@/lib/utils';
import type { SubmissionStatus } from '@/types/submission';

const STYLES: Record<
    SubmissionStatus,
    { label: string; className: string }
> = {
    PENDING: {
        label: 'Pending review',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    },
    APPROVED: {
        label: 'Approved',
        className: 'border-green-500/30 bg-green-500/10 text-green-500',
    },
    REJECTED: {
        label: 'Rejected',
        className: 'border-red-500/30 bg-red-500/10 text-red-500',
    },
    NEEDS_CHANGES: {
        label: 'Changes requested',
        className: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
    },
};

interface SubmissionStatusBadgeProps {
    status: SubmissionStatus;
    className?: string;
}

export function SubmissionStatusBadge({
    status,
    className,
}: SubmissionStatusBadgeProps) {
    const style = STYLES[status];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                style.className,
                className,
            )}
        >
            {style.label}
        </span>
    );
}
