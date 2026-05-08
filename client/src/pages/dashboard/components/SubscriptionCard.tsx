import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { subscriptionsApi } from '@/services/subscriptions';
import { toast } from 'sonner';

function formatDate(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function SubscriptionCard() {
    const navigate = useNavigate();
    const { status, isPro, isDev, tier } = useSubscription();
    const [opening, setOpening] = useState(false);

    if (!status) return null;

    const renewsAt = formatDate(status.subscription?.currentPeriodEnd);
    const trialEndsAt = formatDate(status.trialEndsAt);
    const cancelAtPeriodEnd = status.subscription?.cancelAtPeriodEnd ?? false;

    const headline = (() => {
        if (isDev) return 'Dev Pro';
        if (tier === 'pro') return 'Pro';
        if (tier === 'trial') return 'Pro Trial';
        return 'Free';
    })();

    const subtext = (() => {
        if (isDev) return 'Unlimited play (developer allowlist).';
        if (tier === 'pro') {
            if (cancelAtPeriodEnd && renewsAt) return `Cancels on ${renewsAt}.`;
            return renewsAt ? `Renews on ${renewsAt}.` : 'Active subscription.';
        }
        if (tier === 'trial') {
            return trialEndsAt
                ? `Trial ends on ${trialEndsAt}.`
                : 'Pro features are unlocked during your trial.';
        }
        const remaining = status.gamesRemaining;
        if (remaining <= 0) return 'No free games left today.';
        return `${remaining} of ${status.dailyLimit} free games left today.`;
    })();

    const handlePrimary = async () => {
        if (isDev) return;
        if (tier === 'pro') {
            setOpening(true);
            try {
                const { portalUrl } = await subscriptionsApi.createPortalSession();
                window.location.assign(portalUrl);
            } catch {
                toast.error('Could not open the billing portal.');
            } finally {
                setOpening(false);
            }
            return;
        }
        navigate('/pricing');
    };

    const primaryLabel = (() => {
        if (isDev) return null;
        if (tier === 'pro') return 'Manage';
        if (tier === 'trial') return 'Subscribe';
        return 'Upgrade';
    })();

    return (
        <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                    <div
                        className={
                            isPro
                                ? 'flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500'
                                : 'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground'
                        }
                    >
                        <Crown className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{headline}</span>
                            {(renewsAt || trialEndsAt) && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Calendar className="h-3 w-3" aria-hidden />
                                    {trialEndsAt ?? renewsAt}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">{subtext}</p>
                    </div>
                </div>
                {primaryLabel && (
                    <Button
                        variant={tier === 'pro' ? 'outline' : 'default'}
                        onClick={handlePrimary}
                        disabled={opening}
                    >
                        {opening && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {primaryLabel}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
