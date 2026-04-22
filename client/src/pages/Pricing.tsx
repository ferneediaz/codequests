import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    ArrowLeft,
    Check,
    Code2,
    Crown,
    Infinity as InfinityIcon,
    Loader2,
    Sparkles,
    Swords,
    Wrench,
    Zap,
} from 'lucide-react';
import { subscriptionsApi } from '@/services/subscriptions';
import { useSubscription } from '@/hooks/useSubscription';
import type { CheckoutPlan } from '@/types/subscription';

const PRO_FEATURES = [
    { icon: InfinityIcon, label: 'Unlimited daily battles' },
    { icon: Crown, label: 'Access to ranked & private games' },
    { icon: Swords, label: 'All battle skills enabled' },
    { icon: Code2, label: 'Practice Ground attempt history' },
    { icon: Sparkles, label: 'Future cosmetic & analytics perks' },
];

const FREE_FEATURES = [
    '1 ranked battle per day',
    'Practice problems (no history)',
    'Public matchmaking',
];

type CheckoutReturn = 'success' | 'cancel' | null;

export default function Pricing() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { status, isPro, isDev, source, refresh } = useSubscription();
    const [submitting, setSubmitting] = useState<CheckoutPlan | null>(null);
    const [openingPortal, setOpeningPortal] = useState(false);

    const checkoutReturn: CheckoutReturn = useMemo(() => {
        const value = searchParams.get('checkout');
        if (value === 'success' || value === 'cancel') return value;
        return null;
    }, [searchParams]);

    // Surface Stripe return state and refresh status, then strip the param
    // so a refresh doesn't replay the toast.
    useEffect(() => {
        if (!checkoutReturn) return;
        if (checkoutReturn === 'success') {
            toast.success('Welcome to Pro!', {
                description: 'Your subscription is active. Have fun out there.',
            });
            void refresh();
        } else {
            toast('Checkout cancelled', {
                description:
                    'No charges were made. You can try again any time.',
            });
        }
        const next = new URLSearchParams(searchParams);
        next.delete('checkout');
        setSearchParams(next, { replace: true });
        // refresh / setSearchParams identity is stable enough here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkoutReturn]);

    const handleCheckout = async (plan: CheckoutPlan) => {
        setSubmitting(plan);
        try {
            const { sessionUrl } = await subscriptionsApi.createCheckoutSession(
                plan,
            );
            window.location.href = sessionUrl;
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ??
                'Could not start checkout. Please try again.';
            toast.error(message);
            setSubmitting(null);
        }
    };

    const handleManage = async () => {
        setOpeningPortal(true);
        try {
            const { portalUrl } = await subscriptionsApi.createPortalSession();
            window.location.href = portalUrl;
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ??
                'Could not open the billing portal.';
            toast.error(message);
            setOpeningPortal(false);
        }
    };

    return (
        <div className="relative min-h-[calc(100vh-3.5rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-5xl px-4 py-10">
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back
                    </Button>
                </div>

                <AnimateIn direction="up">
                    <div className="mb-10 text-center">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            CodeQuest Pro
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Battle without{' '}
                            <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                                limits
                            </span>
                        </h1>
                        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                            Free players get one ranked match per day. Pro
                            players queue, invite, and grind as much as they
                            want.
                        </p>
                    </div>
                </AnimateIn>

                {isDev && (
                    <AnimateIn direction="up">
                        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                            <Wrench className="h-4 w-4 shrink-0" />
                            <div>
                                <p className="font-semibold">Dev Pro active</p>
                                <p className="text-xs text-amber-200/80">
                                    Pro is granted by the server developer
                                    allowlist (DEV_PRO_USER_IDS /
                                    DEV_PRO_EMAILS). No Stripe charge will be
                                    made.
                                </p>
                            </div>
                        </div>
                    </AnimateIn>
                )}

                {isPro && !isDev && (
                    <AnimateIn direction="up">
                        <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <Crown className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="font-semibold">
                                        You're on Pro
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {source === 'trial'
                                            ? `Trial active until ${
                                                  status?.trialEndsAt
                                                      ? new Date(
                                                            status.trialEndsAt,
                                                        ).toLocaleDateString()
                                                      : 'soon'
                                              }.`
                                            : 'Manage or cancel any time.'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleManage}
                                disabled={openingPortal || source === 'trial'}
                            >
                                {openingPortal ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Manage Billing
                            </Button>
                        </div>
                    </AnimateIn>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    <AnimateIn direction="up">
                        <PlanCard
                            title="Free"
                            priceLabel="$0"
                            cadence="forever"
                            description="Try a daily battle, practice on your own."
                            features={FREE_FEATURES}
                            footer={
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled
                                >
                                    Current plan for new players
                                </Button>
                            }
                        />
                    </AnimateIn>

                    <AnimateIn direction="up" delay={75}>
                        <PlanCard
                            title="Pro"
                            highlight
                            priceLabel="$5"
                            cadence="every 2 months"
                            description="Best for active players. Cancel any time."
                            features={PRO_FEATURES.map((f) => f.label)}
                            badge={
                                <Badge
                                    variant="secondary"
                                    className="border border-primary/40 text-primary"
                                >
                                    Best value
                                </Badge>
                            }
                            footer={
                                <div className="space-y-3">
                                    <Button
                                        className="h-12 w-full text-base"
                                        onClick={() =>
                                            handleCheckout('bimonthly')
                                        }
                                        disabled={
                                            isPro || submitting !== null
                                        }
                                    >
                                        {submitting === 'bimonthly' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Zap className="mr-2 h-4 w-4" />
                                        )}
                                        {isPro
                                            ? 'You already have Pro'
                                            : 'Upgrade — $5 / 2 months'}
                                    </Button>
                                    <div className="relative">
                                        <Separator />
                                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                            OR
                                        </span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="h-11 w-full"
                                        onClick={() => handleCheckout('yearly')}
                                        disabled={
                                            isPro || submitting !== null
                                        }
                                    >
                                        {submitting === 'yearly' ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Save with yearly — $24.99 / year
                                    </Button>
                                </div>
                            }
                        />
                    </AnimateIn>
                </div>

                <p className="mt-8 text-center text-xs text-muted-foreground">
                    Secure checkout by Stripe. Pricing in USD.
                </p>
            </div>
        </div>
    );
}

interface PlanCardProps {
    title: string;
    priceLabel: string;
    cadence: string;
    description: string;
    features: string[];
    footer: React.ReactNode;
    highlight?: boolean;
    badge?: React.ReactNode;
}

function PlanCard({
    title,
    priceLabel,
    cadence,
    description,
    features,
    footer,
    highlight,
    badge,
}: PlanCardProps) {
    return (
        <Card
            className={
                highlight
                    ? 'relative overflow-hidden border-primary/40 bg-gradient-to-b from-card to-primary/5 shadow-lg shadow-primary/10'
                    : 'h-full'
            }
        >
            {highlight && (
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
            )}
            <CardContent className="relative space-y-6 p-6">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h2 className="text-xl font-bold">{title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    {badge}
                </div>
                <div>
                    <span className="text-4xl font-extrabold tracking-tight">
                        {priceLabel}
                    </span>{' '}
                    <span className="text-sm text-muted-foreground">
                        {cadence}
                    </span>
                </div>
                <ul className="space-y-2 text-sm">
                    {features.map((feature) => (
                        <li
                            key={feature}
                            className="flex items-start gap-2 text-foreground/90"
                        >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
                <div>{footer}</div>
            </CardContent>
        </Card>
    );
}
