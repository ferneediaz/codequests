import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    Swords,
    Users,
    Crown,
    Snowflake,
    Shuffle,
    Clock,
    CloudFog,
    Link2,
    Copy,
    Check,
    Loader2,
    Zap,
    ArrowLeft,
    Sparkles,
    Target,
    Timer,
    Flame,
} from 'lucide-react';
import type {
    BattleMode,
    Difficulty,
    SkillType,
    MatchConfig,
} from '@/types/api';
import api from '@/services/api';
import { toast } from 'sonner';
import { getRankTier } from '@/utils/rank';

const MODES: {
    value: BattleMode;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    tag: string;
}[] = [
        {
            value: 'ONE_V_ONE',
            label: '1v1 Duel',
            icon: Swords,
            description: 'Head-to-head. Fastest correct solution wins.',
            tag: '2 players',
        },
        {
            value: 'BATTLE_ROYALE',
            label: 'Battle Royale',
            icon: Crown,
            description: 'Last coder standing. Elimination rounds.',
            tag: '6–8 players',
        },
        {
            value: 'GROUP',
            label: 'Group Battle',
            icon: Users,
            description: 'Squad up and battle another team.',
            tag: 'Teams',
        },
    ];

const DIFFICULTIES: { value: Difficulty | 'ANY'; label: string; color: string }[] = [
    { value: 'ANY', label: 'Any', color: 'text-muted-foreground' },
    { value: 'EASY', label: 'Easy', color: 'text-green-500' },
    { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-500' },
    { value: 'HARD', label: 'Hard', color: 'text-red-500' },
];

const TIME_LIMITS = [5, 10, 15, 20, 30];

const TOPICS = [
    'arrays',
    'strings',
    'hash-tables',
    'linked-lists',
    'trees',
    'graphs',
    'dynamic-programming',
    'sorting',
    'binary-search',
    'recursion',
    'stacks',
    'math',
];

const SKILLS: {
    type: SkillType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
}[] = [
        {
            type: 'FREEZE',
            label: 'Freeze',
            icon: Snowflake,
            description: "Lock opponent's editor for 10 seconds",
        },
        {
            type: 'SCRAMBLE',
            label: 'Scramble',
            icon: Shuffle,
            description: "Shuffle opponent's code (no undo!)",
        },
        {
            type: 'TIME_STEAL',
            label: 'Time Steal',
            icon: Clock,
            description: 'Steal 5 minutes from opponent',
        },
        {
            type: 'FOG_OF_WAR',
            label: 'Fog of War',
            icon: CloudFog,
            description: "Blur opponent's screen for 20 seconds",
        },
    ];

export default function Play() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const mmr = user?.mmr ?? 1000;
    const tier = useMemo(() => getRankTier(mmr), [mmr]);

    // Config state
    const [mode, setMode] = useState<BattleMode>('ONE_V_ONE');
    const [difficulty, setDifficulty] = useState<Difficulty | 'ANY'>('ANY');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
    const [topic, setTopic] = useState<string | null>(null);
    const [enabledSkills, setEnabledSkills] = useState<SkillType[]>([]);

    // Action state
    const [isCreatingPrivate, setIsCreatingPrivate] = useState(false);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const toggleSkill = (skill: SkillType) => {
        setEnabledSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
        );
    };

    const toggleAllSkills = () => {
        if (enabledSkills.length === SKILLS.length) setEnabledSkills([]);
        else setEnabledSkills(SKILLS.map((s) => s.type));
    };

    const getConfig = (): MatchConfig => ({
        mode,
        preferredDifficulty: difficulty === 'ANY' ? undefined : difficulty,
        preferredTopic: topic ?? undefined,
        timeLimitMinutes,
        enabledSkills,
    });

    const handleFindMatch = () => {
        navigate('/matchmaking', { state: { config: getConfig() } });
    };

    const handleCreatePrivate = async () => {
        setIsCreatingPrivate(true);
        try {
            const { data } = await api.post('/battles/invite', {
                mode,
                timeLimitMinutes,
                enabledSkills: enabledSkills.length > 0 ? enabledSkills : undefined,
                withInviteCode: true,
                preferredTopic: topic ?? undefined,
                preferredDifficulty: difficulty === 'ANY' ? undefined : difficulty,
            });
            setInviteCode(data.inviteCode);
        } catch (error: unknown) {
            const message =
                (error as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Failed to create private game';
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
        setIsJoining(true);
        try {
            const { data } = await api.post(`/battles/invite/${joinCode.trim()}/join`);
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

    const modeMeta = MODES.find((m) => m.value === mode)!;
    const diffMeta = DIFFICULTIES.find((d) => d.value === difficulty)!;

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-7xl px-4 py-8">
                {/* Top bar */}
                <div className="mb-6 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                            color: tier.color,
                            borderColor: `${tier.color}40`,
                            background: `${tier.color}15`,
                        }}
                    >
                        {tier.icon} {tier.name}
                        <span className="text-muted-foreground font-mono">({mmr})</span>
                    </span>
                </div>

                {/* Hero */}
                <AnimateIn direction="up">
                    <div className="mb-8">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            New Battle
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Configure your{' '}
                            <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                                arena
                            </span>
                        </h1>
                        <p className="mt-2 max-w-xl text-muted-foreground">
                            Pick a mode, tune the rules, enable skills — then queue or invite a
                            friend.
                        </p>
                    </div>
                </AnimateIn>

                {/* Main layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* ---------------- LEFT: CONFIG ---------------- */}
                    <div className="space-y-6 lg:col-span-8">
                        {/* Mode */}
                        <AnimateIn direction="up">
                            <Card>
                                <CardContent className="p-6">
                                    <SectionHeader
                                        icon={<Swords className="h-4 w-4 text-primary" />}
                                        title="Mode"
                                    />
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        {MODES.map((m) => {
                                            const Icon = m.icon;
                                            const active = mode === m.value;
                                            return (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setMode(m.value)}
                                                    className={`group relative overflow-hidden rounded-xl border-2 p-5 text-left transition-all ${active
                                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                                        : 'border-border bg-background/40 hover:border-primary/40 hover:bg-card/60'
                                                        }`}
                                                >
                                                    {active && (
                                                        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
                                                    )}
                                                    <div
                                                        className={`relative mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${active
                                                            ? 'bg-primary/15 text-primary'
                                                            : 'bg-muted/40 text-muted-foreground'
                                                            }`}
                                                    >
                                                        <Icon className="h-5 w-5" />
                                                    </div>
                                                    <div className="relative flex items-center gap-2">
                                                        <h3 className="font-semibold">{m.label}</h3>
                                                        <Badge
                                                            variant="outline"
                                                            className="h-4 px-1.5 text-[10px]"
                                                        >
                                                            {m.tag}
                                                        </Badge>
                                                    </div>
                                                    <p className="relative mt-1 text-xs text-muted-foreground">
                                                        {m.description}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </AnimateIn>

                        {/* Settings */}
                        <AnimateIn direction="up" delay={75}>
                            <Card>
                                <CardContent className="space-y-6 p-6">
                                    <SectionHeader
                                        icon={<Target className="h-4 w-4 text-primary" />}
                                        title="Settings"
                                    />

                                    {/* Difficulty */}
                                    <div>
                                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Difficulty
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {DIFFICULTIES.map((d) => (
                                                <Chip
                                                    key={d.value}
                                                    active={difficulty === d.value}
                                                    onClick={() => setDifficulty(d.value)}
                                                >
                                                    <span
                                                        className={difficulty === d.value ? '' : d.color}
                                                    >
                                                        {d.label}
                                                    </span>
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Time Limit */}
                                    <div>
                                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            <Timer className="h-3 w-3" />
                                            Time Limit
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {TIME_LIMITS.map((t) => (
                                                <Chip
                                                    key={t}
                                                    active={timeLimitMinutes === t}
                                                    onClick={() => setTimeLimitMinutes(t)}
                                                >
                                                    {t} min
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Topic */}
                                    <div>
                                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Topic <span className="normal-case">(optional)</span>
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Chip active={topic === null} onClick={() => setTopic(null)}>
                                                Any
                                            </Chip>
                                            {TOPICS.map((t) => (
                                                <Chip
                                                    key={t}
                                                    active={topic === t}
                                                    onClick={() => setTopic(t)}
                                                >
                                                    {t}
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </AnimateIn>

                        {/* Skills */}
                        <AnimateIn direction="up" delay={150}>
                            <Card>
                                <CardContent className="p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <SectionHeader
                                            icon={<Flame className="h-4 w-4 text-primary" />}
                                            title="Battle Skills"
                                            subtitle="Toggle power-ups available during the match"
                                        />
                                        <Button variant="outline" size="sm" onClick={toggleAllSkills}>
                                            {enabledSkills.length === SKILLS.length
                                                ? 'Disable All'
                                                : 'Enable All'}
                                        </Button>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {SKILLS.map((skill) => {
                                            const Icon = skill.icon;
                                            const enabled = enabledSkills.includes(skill.type);
                                            return (
                                                <button
                                                    key={skill.type}
                                                    onClick={() => toggleSkill(skill.type)}
                                                    className={`group flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${enabled
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border bg-background/40 hover:border-primary/40'
                                                        }`}
                                                >
                                                    <div
                                                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${enabled
                                                            ? 'bg-primary/15 text-primary'
                                                            : 'bg-muted/40 text-muted-foreground'
                                                            }`}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-semibold">
                                                                {skill.label}
                                                            </h3>
                                                            <span
                                                                className={`text-[10px] font-bold uppercase tracking-wider ${enabled ? 'text-primary' : 'text-muted-foreground/60'
                                                                    }`}
                                                            >
                                                                {enabled ? 'ON' : 'OFF'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {skill.description}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </AnimateIn>
                    </div>

                    {/* ---------------- RIGHT: SUMMARY + ACTIONS ---------------- */}
                    <div className="lg:col-span-4">
                        <div className="lg:sticky lg:top-20 space-y-4">
                            <AnimateIn direction="right">
                                <Card className="border-primary/30 bg-gradient-to-b from-card to-card/60">
                                    <CardContent className="space-y-5 p-6">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Summary
                                            </p>
                                            <h2 className="mt-1 text-xl font-bold">
                                                {modeMeta.label}
                                            </h2>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <SummaryRow label="Difficulty" value={diffMeta.label} />
                                            <SummaryRow
                                                label="Time"
                                                value={`${timeLimitMinutes} min`}
                                            />
                                            <SummaryRow label="Topic" value={topic ?? 'Any'} />
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-muted-foreground">Skills</span>
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    {enabledSkills.length === 0 ? (
                                                        <span className="font-medium">None</span>
                                                    ) : (
                                                        enabledSkills.map((s) => (
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

                                        <Button
                                            className="h-12 w-full text-base"
                                            onClick={handleFindMatch}
                                        >
                                            <Zap className="mr-2 h-4 w-4" />
                                            Find Match
                                        </Button>

                                        <div className="relative">
                                            <Separator />
                                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                                OR
                                            </span>
                                        </div>

                                        {!inviteCode ? (
                                            <Button
                                                variant="outline"
                                                className="h-11 w-full"
                                                onClick={handleCreatePrivate}
                                                disabled={isCreatingPrivate}
                                            >
                                                {isCreatingPrivate ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Link2 className="mr-2 h-4 w-4" />
                                                )}
                                                Create Private Game
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
    icon,
    title,
    subtitle,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}) {
    return (
        <div className="mb-4">
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-base font-semibold">{title}</h2>
            </div>
            {subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground'
                }`}
        >
            {children}
        </button>
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
