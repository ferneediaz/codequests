import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Check,
    Copy,
    Crown,
    Link2,
    Loader2,
    Users,
    Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnimateIn } from '@/components/layout/AnimateIn';
import api from '@/services/api';
import { usePaywall } from '@/hooks/usePaywall';
import { useSubscription } from '@/hooks/useSubscription';
import type {
    CreateBattleRequest,
    CreateClanWarsRequest,
} from '@/types/api';
import {
    CLAN_WARS_FORMATS,
    DIFFICULTIES,
    MODES,
    ROYALE_FORMATS,
    SKILLS,
} from '../constants';
import { formatSeconds } from '../utils';
import type { PlayConfig } from '../usePlayConfig';
import { SummaryRow } from './SummaryRow';

export function InvitePanel({ cfg }: { cfg: PlayConfig }) {
    const navigate = useNavigate();
    const { requireCanPlay } = usePaywall();
    const { refresh: refreshSubscription } = useSubscription();

    const [isCreatingPrivate, setIsCreatingPrivate] = useState(false);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const modeMeta = MODES.find((m) => m.value === cfg.mode)!;
    const diffMeta = DIFFICULTIES.find((d) => d.value === cfg.difficulty)!;

    const handleFindMatch = () => {
        if (cfg.mode === 'BATTLE_ROYALE' || cfg.mode === 'GROUP') {
            toast.error(
                cfg.mode === 'BATTLE_ROYALE'
                    ? 'Battle Royale is lobby-only. Create a private game and share the invite code.'
                    : 'Clan Wars is lobby-only. Create a clan war lobby and share the invite code.',
            );
            return;
        }
        if (!requireCanPlay()) return;
        navigate('/matchmaking', { state: { config: cfg.getMatchConfig() } });
    };

    const handleCreatePrivate = async () => {
        if (!requireCanPlay()) return;

        if (cfg.mode === 'BATTLE_ROYALE' && !cfg.royaleValid) {
            toast.error(
                cfg.royaleErrors[0]?.message ?? 'Invalid Battle Royale configuration.',
            );
            return;
        }
        if (cfg.mode === 'GROUP' && !cfg.cwValid) {
            toast.error(cfg.cwErrors[0] ?? 'Invalid Clan Wars configuration.');
            return;
        }

        if (cfg.mode === 'GROUP') {
            const payload: CreateClanWarsRequest = {
                clanWarsFormat: cfg.cwFormat,
                teamSize: cfg.cwTeamSize,
                rounds: cfg.cwRounds.map((r) => ({
                    timeLimitSeconds: r.timeLimitSeconds,
                })),
                enabledSkills:
                    cfg.enabledSkills.length > 0 ? cfg.enabledSkills : undefined,
                preferredTopic: cfg.topic ?? undefined,
                preferredDifficulty:
                    cfg.difficulty === 'ANY' ? undefined : cfg.difficulty,
                withInviteCode: true,
                teamOne: cfg.myClanId ? { clanId: cfg.myClanId } : undefined,
            };
            setIsCreatingPrivate(true);
            try {
                const { data } = await api.post('/battles/clan-wars', payload);
                setInviteCode(data.inviteCode);
                void refreshSubscription();
            } catch (error: unknown) {
                const message =
                    (error as { response?: { data?: { message?: string } } })?.response
                        ?.data?.message ?? 'Failed to create clan wars lobby';
                toast.error(message);
            } finally {
                setIsCreatingPrivate(false);
            }
            return;
        }

        const payload: CreateBattleRequest = {
            mode: cfg.mode,
            timeLimitMinutes: cfg.timeLimitMinutes,
            enabledSkills:
                cfg.enabledSkills.length > 0 ? cfg.enabledSkills : undefined,
            withInviteCode: true,
            preferredTopic: cfg.topic ?? undefined,
            preferredDifficulty:
                cfg.difficulty === 'ANY' ? undefined : cfg.difficulty,
        };

        if (cfg.mode === 'BATTLE_ROYALE') {
            payload.battleRoyaleFormat = cfg.royaleFormat;
            payload.maxPlayers = cfg.royaleMaxPlayers;
            payload.rounds = cfg.royaleRounds.map((r) => ({
                timeLimitSeconds: r.timeLimitSeconds,
                eliminateCount: r.eliminateCount,
            }));
        }

        setIsCreatingPrivate(true);
        try {
            const { data } = await api.post('/battles/invite', payload);
            setInviteCode(data.inviteCode);
            void refreshSubscription();
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response
                    ?.data?.message ?? 'Failed to create private game';
            console.error('Failed to create private game:', error);
            toast.error(message);
        } finally {
            setIsCreatingPrivate(false);
        }
    };

    const handleCopyCode = async () => {
        if (!inviteCode) return;
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJoinByCode = async () => {
        if (!joinCode.trim()) return;
        if (!requireCanPlay()) return;
        setIsJoining(true);
        try {
            const path =
                cfg.mode === 'GROUP'
                    ? `/battles/clan-wars/invite/${joinCode.trim()}/join`
                    : `/battles/invite/${joinCode.trim()}/join`;
            const { data } = await api.post(path);
            void refreshSubscription();
            navigate(`/battle/${data.id}`);
        } catch (error) {
            console.error('Failed to join game:', error);
            toast.error('Failed to join game. Check the invite code and try again.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleGoToBattle = () => {
        if (!inviteCode) return;
        api.get(`/battles/invite/${inviteCode}`).then(({ data }) => {
            navigate(`/battle/${data.id}`);
        });
    };

    return (
        <AnimateIn direction="right">
            <Card className="border-primary/30 bg-gradient-to-b from-card to-card/60">
                <CardContent className="space-y-5 p-6">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Summary
                        </p>
                        <h2 className="mt-1 text-xl font-bold">{modeMeta.label}</h2>
                    </div>

                    <div className="space-y-2 text-sm">
                        {cfg.mode === 'BATTLE_ROYALE' ? (
                            <>
                                <SummaryRow
                                    label="Format"
                                    value={
                                        ROYALE_FORMATS.find(
                                            (f) => f.value === cfg.royaleFormat,
                                        )?.label ?? cfg.royaleFormat
                                    }
                                />
                                <SummaryRow
                                    label="Lobby"
                                    value={`${cfg.royaleMaxPlayers} players`}
                                />
                                <SummaryRow
                                    label="Rounds"
                                    value={`${cfg.royaleRounds.length}`}
                                />
                                <SummaryRow
                                    label="Total time"
                                    value={formatSeconds(cfg.royaleTotalSeconds)}
                                />
                                <SummaryRow
                                    label="Eliminations"
                                    value={`${cfg.royaleTotalElim} / ${cfg.royaleMaxPlayers - 1}`}
                                />
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground">
                                        Progression
                                    </span>
                                    <div className="flex flex-wrap justify-end gap-1">
                                        {cfg.royaleRounds.map((r, i) => (
                                            <Badge
                                                key={i}
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                R{i + 1}: −{r.eliminateCount}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <SummaryRow label="Difficulty" value={diffMeta.label} />
                                <SummaryRow label="Topic" value={cfg.topic ?? 'Any'} />
                            </>
                        ) : cfg.mode === 'GROUP' ? (
                            <>
                                <SummaryRow
                                    label="Format"
                                    value={
                                        CLAN_WARS_FORMATS.find(
                                            (f) => f.value === cfg.cwFormat,
                                        )?.label ?? cfg.cwFormat
                                    }
                                />
                                <SummaryRow
                                    label="Teams"
                                    value={`${cfg.cwTeamSize}v${cfg.cwTeamSize}`}
                                />
                                <SummaryRow
                                    label="Rounds"
                                    value={`${cfg.cwRounds.length}`}
                                />
                                <SummaryRow
                                    label="Total time"
                                    value={formatSeconds(cfg.cwTotalSeconds)}
                                />
                                <SummaryRow label="Difficulty" value={diffMeta.label} />
                                <SummaryRow label="Topic" value={cfg.topic ?? 'Any'} />
                            </>
                        ) : (
                            <>
                                <SummaryRow label="Difficulty" value={diffMeta.label} />
                                <SummaryRow
                                    label="Time"
                                    value={`${cfg.timeLimitMinutes} min`}
                                />
                                <SummaryRow label="Topic" value={cfg.topic ?? 'Any'} />
                            </>
                        )}
                        <div className="flex items-start justify-between gap-2">
                            <span className="text-muted-foreground">Skills</span>
                            <div className="flex flex-wrap justify-end gap-1">
                                {cfg.enabledSkills.length === 0 ? (
                                    <span className="font-medium">None</span>
                                ) : (
                                    cfg.enabledSkills.map((s) => (
                                        <Badge
                                            key={s}
                                            variant="secondary"
                                            className="text-[10px]"
                                        >
                                            {SKILLS.find((sk) => sk.type === s)?.label}
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {cfg.mode === 'BATTLE_ROYALE' ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                            <p className="flex items-center gap-1 font-medium text-primary">
                                <Crown className="h-3.5 w-3.5" />
                                Lobby-only mode
                            </p>
                            <p className="mt-1">
                                Battle Royale cannot be matchmade. Create a private lobby
                                and share the invite code with your players.
                            </p>
                        </div>
                    ) : cfg.mode === 'GROUP' ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                            <p className="flex items-center gap-1 font-medium text-primary">
                                <Users className="h-3.5 w-3.5" />
                                Lobby-only mode
                            </p>
                            <p className="mt-1">
                                Clan Wars lobbies are private. Create a lobby and share the
                                invite code with both teams.
                            </p>
                        </div>
                    ) : (
                        <Button
                            className="h-12 w-full text-base"
                            onClick={handleFindMatch}
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Find Match
                        </Button>
                    )}

                    <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            {cfg.mode === 'BATTLE_ROYALE' || cfg.mode === 'GROUP'
                                ? 'Create'
                                : 'OR'}
                        </span>
                    </div>

                    {!inviteCode ? (
                        <Button
                            variant={
                                cfg.mode === 'BATTLE_ROYALE' || cfg.mode === 'GROUP'
                                    ? 'default'
                                    : 'outline'
                            }
                            className={
                                cfg.mode === 'BATTLE_ROYALE' || cfg.mode === 'GROUP'
                                    ? 'h-12 w-full text-base'
                                    : 'h-11 w-full'
                            }
                            onClick={handleCreatePrivate}
                            disabled={
                                isCreatingPrivate ||
                                (cfg.mode === 'BATTLE_ROYALE' && !cfg.royaleValid) ||
                                (cfg.mode === 'GROUP' && !cfg.cwValid)
                            }
                        >
                            {isCreatingPrivate ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : cfg.mode === 'BATTLE_ROYALE' ? (
                                <Crown className="mr-2 h-4 w-4" />
                            ) : cfg.mode === 'GROUP' ? (
                                <Users className="mr-2 h-4 w-4" />
                            ) : (
                                <Link2 className="mr-2 h-4 w-4" />
                            )}
                            {cfg.mode === 'BATTLE_ROYALE'
                                ? 'Create Royale Lobby'
                                : cfg.mode === 'GROUP'
                                  ? 'Create Clan Wars Lobby'
                                  : 'Create Private Game'}
                        </Button>
                    ) : (
                        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                            <p className="mb-2 text-xs text-muted-foreground">
                                Share this invite code:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 truncate rounded-md bg-background/80 px-3 py-2 text-center font-mono text-base font-bold tracking-widest">
                                    {inviteCode}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyCode}
                                >
                                    {copied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="mt-3 w-full"
                                onClick={handleGoToBattle}
                            >
                                Go to Battle Lobby
                            </Button>
                        </div>
                    )}

                    <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            OR
                        </span>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Join by Code
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Invite code"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === 'Enter' && handleJoinByCode()
                                }
                                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Button
                                variant="outline"
                                onClick={handleJoinByCode}
                                disabled={!joinCode.trim() || isJoining}
                            >
                                {isJoining ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Join'
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </AnimateIn>
    );
}
