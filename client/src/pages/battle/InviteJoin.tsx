import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    Loader2,
    Swords,
    Crown,
    Users,
    Timer,
    Sparkles,
    AlertCircle,
    LogIn,
    ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import type { BattleResponse } from '@/types/api';
import { savePendingInvite } from '@/lib/pendingInvite';
import { usePaywall } from '@/hooks/usePaywall';
import { useSubscription } from '@/hooks/useSubscription';

type LoadState =
    | { status: 'loading' }
    | { status: 'ready'; battle: BattleResponse }
    | { status: 'error'; message: string };

function modeLabel(mode: BattleResponse['mode']): string {
    switch (mode) {
        case 'ONE_V_ONE':
            return '1v1 Duel';
        case 'BATTLE_ROYALE':
            return 'Battle Royale';
        case 'GROUP':
            return 'Group Battle';
        case 'CLAN_VS_CLAN':
            return 'Clan vs Clan';
        default:
            return mode;
    }
}

function ModeIconFor({
    mode,
    className,
}: {
    mode: BattleResponse['mode'];
    className?: string;
}) {
    if (mode === 'BATTLE_ROYALE') return <Crown className={className} />;
    if (mode === 'GROUP' || mode === 'CLAN_VS_CLAN')
        return <Users className={className} />;
    return <Swords className={className} />;
}

export default function InviteJoin() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading: authLoading, user } = useAppSelector(
        (state) => state.auth,
    );
    const { requireCanPlay } = usePaywall();
    const { refresh: refreshSubscription } = useSubscription();

    const normalizedCode = useMemo(() => code?.trim().toUpperCase() ?? '', [code]);

    const [state, setState] = useState<LoadState>(() =>
        normalizedCode
            ? { status: 'loading' }
            : { status: 'error', message: 'Missing invite code.' },
    );
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        if (!normalizedCode) return;

        if (authLoading) return;

        // Gate on auth: the backend protects GET /battles/invite/:code with JWT.
        // Defer lookup until the user is signed in; the render layer shows the
        // sign-in prompt in the meantime and this effect reruns after sign-in.
        if (!isAuthenticated) return;

        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get<BattleResponse>(
                    `/battles/invite/${normalizedCode}`,
                );
                if (!cancelled) setState({ status: 'ready', battle: data });
            } catch (err: unknown) {
                if (cancelled) return;
                const response = (err as {
                    response?: { status?: number; data?: { message?: string } };
                })?.response;
                const serverMessage = response?.data?.message;
                const message =
                    response?.status === 404
                        ? 'This invite code is invalid or no longer exists.'
                        : response?.status === 400
                          ? serverMessage ??
                            'This invite has expired or the battle has already started.'
                          : serverMessage ?? 'Failed to load invite.';
                setState({ status: 'error', message });
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [normalizedCode, isAuthenticated, authLoading]);

    const handleSignIn = () => {
        savePendingInvite(normalizedCode);
        navigate('/login');
    };

    const handleJoin = async () => {
        if (state.status !== 'ready') return;
        // Existing participants can always re-enter — they've already paid
        // the daily-game cost when the battle was created/joined.
        const isExistingParticipant = !!user && state.battle.participants.some(
            (p) => p.userId === user.id,
        );
        if (!isExistingParticipant && !requireCanPlay()) return;
        setIsJoining(true);
        try {
            const { data } = await api.post<BattleResponse>(
                `/battles/invite/${normalizedCode}/join`,
            );
            void refreshSubscription();
            navigate(`/battle/${data.id}`);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to join battle.';
            toast.error(message);
            setIsJoining(false);
        }
    };

    const alreadyParticipant = useMemo(() => {
        if (state.status !== 'ready' || !user) return false;
        return state.battle.participants.some((p) => p.userId === user.id);
    }, [state, user]);

    return (
        <div className="relative min-h-[calc(100vh-3.5rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto flex max-w-2xl flex-col px-4 py-12">
                <AnimateIn direction="up">
                    <div className="mb-6 text-center">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            Battle Invite
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                            You've been{' '}
                            <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                                challenged
                            </span>
                        </h1>
                        <p className="mt-2 text-muted-foreground">
                            Join the battle using invite code{' '}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                                {normalizedCode || '—'}
                            </code>
                        </p>
                    </div>
                </AnimateIn>

                <AnimateIn direction="up" delay={75}>
                    <Card className="border-primary/30">
                        <CardContent className="space-y-6 p-6">
                            {authLoading || state.status === 'loading' ? (
                                <LoadingBlock />
                            ) : !isAuthenticated ? (
                                <SignInBlock onSignIn={handleSignIn} />
                            ) : state.status === 'error' ? (
                                <ErrorBlock
                                    message={state.message}
                                    onBack={() => navigate('/dashboard')}
                                />
                            ) : (
                                <ReadyBlock
                                    battle={state.battle}
                                    alreadyParticipant={alreadyParticipant}
                                    onJoin={handleJoin}
                                    isJoining={isJoining}
                                />
                            )}
                        </CardContent>
                    </Card>
                </AnimateIn>
            </div>
        </div>
    );
}

function LoadingBlock() {
    return (
        <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );
}

function SignInBlock({ onSignIn }: { onSignIn: () => void }) {
    return (
        <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LogIn className="h-5 w-5" />
            </div>
            <div>
                <h2 className="text-lg font-semibold">Sign in to join</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    You need a CodeQuest account to accept this invite.
                </p>
            </div>
            <Button className="w-full h-11" onClick={onSignIn}>
                <LogIn className="mr-2 h-4 w-4" />
                Continue to Sign In
            </Button>
            <p className="text-xs text-muted-foreground">
                We'll bring you right back here after signing in.
            </p>
        </div>
    );
}

function ErrorBlock({
    message,
    onBack,
}: {
    message: string;
    onBack: () => void;
}) {
    return (
        <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <AlertCircle className="h-5 w-5" />
            </div>
            <div>
                <h2 className="text-lg font-semibold">Invite unavailable</h2>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={onBack}>
                Back to Dashboard
            </Button>
        </div>
    );
}

function ReadyBlock({
    battle,
    alreadyParticipant,
    onJoin,
    isJoining,
}: {
    battle: BattleResponse;
    alreadyParticipant: boolean;
    onJoin: () => void;
    isJoining: boolean;
}) {
    const creator = battle.participants[0];
    const expiresAt = battle.inviteExpiresAt
        ? new Date(battle.inviteExpiresAt)
        : null;
    const mutual = battle.mutualFriendsCount ?? 0;
    const inviterName = battle.inviter?.username ?? creator?.username;

    return (
        <div className="space-y-6">
            {inviterName && (mutual > 0) && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    Invited by <span className="font-medium text-foreground">{inviterName}</span>
                    {' · '}
                    <span className="text-foreground">{mutual}</span>{' '}
                    mutual friend{mutual === 1 ? '' : 's'}
                </div>
            )}

            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <ModeIconFor mode={battle.mode} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Mode
                    </p>
                    <h2 className="truncate text-lg font-semibold">
                        {modeLabel(battle.mode)}
                    </h2>
                </div>
                <Badge variant="outline" className="shrink-0">
                    <Timer className="mr-1 h-3 w-3" />
                    {battle.timeLimitMinutes} min
                </Badge>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
                <SummaryRow
                    label="Created by"
                    value={creator?.username ?? 'Unknown'}
                />
                <SummaryRow
                    label="Players"
                    value={`${battle.participants.length} waiting`}
                />
                {battle.enabledSkills && battle.enabledSkills.length > 0 && (
                    <div className="flex items-start justify-between gap-2">
                        <span className="text-muted-foreground">Skills</span>
                        <div className="flex flex-wrap justify-end gap-1">
                            {battle.enabledSkills.map((s) => (
                                <Badge
                                    key={s}
                                    variant="secondary"
                                    className="text-[10px]"
                                >
                                    {s.replace('_', ' ')}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
                {expiresAt && (
                    <SummaryRow
                        label="Expires"
                        value={expiresAt.toLocaleString()}
                    />
                )}
            </div>

            <Button
                className="h-12 w-full text-base"
                onClick={onJoin}
                disabled={isJoining}
            >
                {isJoining ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {alreadyParticipant ? 'Return to Lobby' : 'Join Battle'}
            </Button>

            {alreadyParticipant && (
                <p className="text-center text-xs text-muted-foreground">
                    You're already in this battle — we'll take you back to the
                    lobby.
                </p>
            )}
        </div>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    );
}
