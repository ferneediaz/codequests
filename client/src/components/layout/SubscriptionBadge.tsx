import { Link } from 'react-router-dom';
import { Crown, Infinity as InfinityIcon, Wrench } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

/**
 * Compact navbar pill that surfaces subscription state at a glance.
 *
 * - Free user with games left:  "1 free game today"
 * - Free user out of games:     "0 today — Upgrade" (links to /pricing)
 * - Trial / Pro user:           "PRO ∞"
 * - Dev allowlist user:         "DEV PRO ∞"
 *
 * Hidden until the first status fetch lands so we don't flash misleading
 * counts. Always renders as a link to /pricing so users can find the
 * upgrade page from anywhere in the app.
 */
export function SubscriptionBadge() {
    const { status, isPro, isDev, source } = useSubscription();

    if (!status) return null;

    if (isPro) {
        const label = isDev
            ? 'DEV PRO'
            : source === 'trial'
              ? 'TRIAL'
              : 'PRO';
        const tone = isDev
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : source === 'trial'
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-200'
              : 'border-primary/40 bg-primary/10 text-primary';
        const Icon = isDev ? Wrench : Crown;

        return (
            <Link
                to="/pricing"
                className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide no-underline transition-colors hover:opacity-90 sm:inline-flex ${tone}`}
                title={
                    isDev
                        ? 'Pro granted by developer allowlist'
                        : source === 'trial'
                          ? 'Free trial active'
                          : 'Pro subscription active'
                }
            >
                <Icon className="h-3 w-3" />
                {label}
                <InfinityIcon className="h-3 w-3" />
            </Link>
        );
    }

    const remaining = Math.max(0, status.gamesRemaining);
    const isOut = remaining === 0;
    const tone = isOut
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
        : 'border-border bg-muted/30 text-muted-foreground hover:text-foreground';

    return (
        <Link
            to="/pricing"
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide no-underline transition-colors sm:inline-flex ${tone}`}
            title={
                isOut
                    ? 'Out of free games today — upgrade for unlimited'
                    : `${remaining} free game${remaining === 1 ? '' : 's'} remaining today`
            }
        >
            {isOut ? (
                <>0 today · Upgrade</>
            ) : (
                <>
                    {remaining} free {remaining === 1 ? 'game' : 'games'}
                </>
            )}
        </Link>
    );
}
