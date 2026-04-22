import { useEffect, useMemo, useState } from 'react';
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
    Minus,
    Plus,
    Trash2,
    AlertCircle,
    Layers,
    Trophy,
} from 'lucide-react';
import type {
    BattleMode,
    BattleRoyaleFormat,
    Difficulty,
    SkillType,
    MatchConfig,
    RoundConfig,
    RoyalePreset,
    CreateBattleRequest,
} from '@/types/api';
import api from '@/services/api';
import { toast } from 'sonner';
import { getRankTier } from '@/utils/rank';
import { usePaywall } from '@/hooks/usePaywall';
import { useSubscription } from '@/hooks/useSubscription';

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

// --------------------------------------------------------------------
// Battle Royale constants & helpers (mirror server validateConfig rules)
// --------------------------------------------------------------------

const BR_MIN_PLAYERS = 3;
const BR_MAX_PLAYERS = 50;
const BR_MIN_ROUND_SECONDS = 10;
const BR_MAX_ROUND_SECONDS = 7200;
const BR_MIN_ROUNDS = 2;

const ROYALE_FORMATS: {
    value: BattleRoyaleFormat;
    label: string;
    description: string;
}[] = [
        {
            value: 'SAME_PROBLEM',
            label: 'Same Problem',
            description:
                'Every surviving player solves the same problem each round. First correct solves advance; slowest are eliminated.',
        },
        {
            value: 'SCORE_ATTACK',
            label: 'Score Attack',
            description:
                'Pick from a pool of problems. Solve as many as you can per round — lowest cumulative score is eliminated.',
        },
    ];

const ROUND_TIME_PRESETS = [60, 120, 180, 300, 600, 900, 1800, 3600];

/**
 * Build a sensible default round list for a given lobby size that satisfies
 * server constraints: rounds.length >= 2, sum(eliminateCount) === maxPlayers-1,
 * last round eliminateCount === 1, no over-elimination.
 *
 * Strategy: front-load eliminations so the list fits in a small number of rounds
 * (3 rounds for most sizes), always finishing with a 1v1 round.
 */
function buildDefaultRounds(maxPlayers: number): RoundConfig[] {
    const totalToEliminate = Math.max(0, maxPlayers - 1);
    // Minimum legal: 2 rounds.
    if (totalToEliminate <= 1) {
        // maxPlayers === 2 is not allowed server-side, but if a caller ever
        // passes one through, fall back to a still-valid 2-round config once
        // the caller raises maxPlayers. Return a safe 2-round skeleton.
        return [
            { timeLimitSeconds: 300, eliminateCount: 0 },
            { timeLimitSeconds: 300, eliminateCount: 1 },
        ];
    }

    // Default to 3 rounds for any lobby >= 4 (maxPlayers - 1 == 3 handles 4p exactly).
    // For 3p lobby, we must use 2 rounds (totalToEliminate === 2).
    if (maxPlayers === 3) {
        return [
            { timeLimitSeconds: 300, eliminateCount: 1 },
            { timeLimitSeconds: 300, eliminateCount: 1 },
        ];
    }

    // Three rounds: [a, b, 1] with a + b === totalToEliminate - 1.
    const preFinal = totalToEliminate - 1;
    const r1 = Math.ceil(preFinal / 2);
    const r2 = preFinal - r1;
    return [
        { timeLimitSeconds: 300, eliminateCount: r1 },
        { timeLimitSeconds: 300, eliminateCount: r2 },
        { timeLimitSeconds: 300, eliminateCount: 1 },
    ];
}

export interface RoyaleValidationError {
    roundIndex?: number;
    message: string;
}

/**
 * Pure client-side validation that mirrors server `validateConfig` in
 * `battle-royale.service.ts`. Returns an empty array when the config is valid.
 */
function validateRoyaleConfig(cfg: {
    maxPlayers: number;
    rounds: RoundConfig[];
}): RoyaleValidationError[] {
    const errors: RoyaleValidationError[] = [];
    const { maxPlayers, rounds } = cfg;

    if (!Number.isInteger(maxPlayers) || maxPlayers < BR_MIN_PLAYERS || maxPlayers > BR_MAX_PLAYERS) {
        errors.push({
            message: `Lobby size must be an integer between ${BR_MIN_PLAYERS} and ${BR_MAX_PLAYERS}.`,
        });
    }

    if (!rounds || rounds.length < BR_MIN_ROUNDS) {
        errors.push({
            message: `Battle Royale requires at least ${BR_MIN_ROUNDS} rounds and must end with a 1v1 finale.`,
        });
    }

    if (rounds && rounds.length > Math.max(0, maxPlayers - 1)) {
        errors.push({
            message: `Too many rounds (${rounds.length}) for a ${maxPlayers}-player lobby. Maximum is ${maxPlayers - 1}.`,
        });
    }

    let sum = 0;
    let remaining = maxPlayers;
    rounds?.forEach((r, i) => {
        if (!Number.isInteger(r.timeLimitSeconds)) {
            errors.push({ roundIndex: i, message: `Round ${i + 1}: time must be a whole number of seconds.` });
        }
        if (r.timeLimitSeconds < BR_MIN_ROUND_SECONDS || r.timeLimitSeconds > BR_MAX_ROUND_SECONDS) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: time must be between ${BR_MIN_ROUND_SECONDS}s and ${BR_MAX_ROUND_SECONDS}s.`,
            });
        }
        if (!Number.isInteger(r.eliminateCount) || r.eliminateCount < 0) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: eliminations must be a non-negative whole number.`,
            });
        }
        sum += r.eliminateCount;
        remaining -= r.eliminateCount;
        if (remaining < 1) {
            errors.push({
                roundIndex: i,
                message: `Round ${i + 1}: over-elimination — no players would remain after this round.`,
            });
        }
    });

    if (rounds && rounds.length >= 1 && sum !== maxPlayers - 1) {
        errors.push({
            message: `Total eliminations (${sum}) must equal lobby size − 1 (${maxPlayers - 1}).`,
        });
    }

    if (rounds && rounds.length >= 1 && rounds[rounds.length - 1].eliminateCount !== 1) {
        errors.push({
            message: 'The final round must eliminate exactly 1 player (1v1 finale).',
        });
    }

    return errors;
}

/**
 * Compute remaining-players progression for the round builder UI.
 * Returns an array aligned with `rounds` where each entry is the number of
 * players that START that round.
 */
function computeRoyaleProgression(rounds: RoundConfig[], maxPlayers: number): number[] {
    const out: number[] = [];
    let remaining = maxPlayers;
    for (const r of rounds) {
        out.push(remaining);
        remaining = Math.max(0, remaining - (r.eliminateCount || 0));
    }
    return out;
}

function formatSeconds(n: number): string {
    if (!Number.isFinite(n) || n < 0) return '—';
    if (n < 60) return `${n}s`;
    const m = Math.floor(n / 60);
    const s = n % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export default function Play() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const mmr = user?.mmr ?? 1000;
    const tier = useMemo(() => getRankTier(mmr), [mmr]);
    const { requireCanPlay } = usePaywall();
    const { refresh: refreshSubscription } = useSubscription();

    // Config state
    const [mode, setMode] = useState<BattleMode>('ONE_V_ONE');
    const [difficulty, setDifficulty] = useState<Difficulty | 'ANY'>('ANY');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
    const [topic, setTopic] = useState<string | null>(null);
    const [enabledSkills, setEnabledSkills] = useState<SkillType[]>([]);

    // Battle Royale config state
    const [royaleFormat, setRoyaleFormat] = useState<BattleRoyaleFormat>('SAME_PROBLEM');
    const [royaleMaxPlayers, setRoyaleMaxPlayers] = useState(8);
    const [royaleRounds, setRoyaleRounds] = useState<RoundConfig[]>(() => buildDefaultRounds(8));
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [presets, setPresets] = useState<RoyalePreset[]>([]);
    const [presetsLoading, setPresetsLoading] = useState(false);
    const [presetsError, setPresetsError] = useState<string | null>(null);

    // Action state
    const [isCreatingPrivate, setIsCreatingPrivate] = useState(false);
    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Lazy-load BR presets when the user first enters BATTLE_ROYALE mode.
    useEffect(() => {
        if (mode !== 'BATTLE_ROYALE') return;
        if (presets.length > 0 || presetsLoading) return;
        setPresetsLoading(true);
        setPresetsError(null);
        api
            .get<RoyalePreset[]>('/battles/royale/presets')
            .then(({ data }) => {
                setPresets(data);
            })
            .catch(() => {
                setPresetsError('Failed to load presets. You can still build a custom config.');
            })
            .finally(() => setPresetsLoading(false));
    }, [mode, presets.length, presetsLoading]);

    // Live validation of the BR config.
    const royaleErrors = useMemo(
        () =>
            mode === 'BATTLE_ROYALE'
                ? validateRoyaleConfig({ maxPlayers: royaleMaxPlayers, rounds: royaleRounds })
                : [],
        [mode, royaleMaxPlayers, royaleRounds],
    );
    const royaleValid = royaleErrors.length === 0;
    const royaleProgression = useMemo(
        () => computeRoyaleProgression(royaleRounds, royaleMaxPlayers),
        [royaleRounds, royaleMaxPlayers],
    );
    const royaleTotalSeconds = useMemo(
        () => royaleRounds.reduce((acc, r) => acc + (r.timeLimitSeconds || 0), 0),
        [royaleRounds],
    );
    const royaleTotalElim = useMemo(
        () => royaleRounds.reduce((acc, r) => acc + (r.eliminateCount || 0), 0),
        [royaleRounds],
    );

    // Detect when the user has diverged from the active preset.
    const selectedPreset = useMemo(
        () => presets.find((p) => p.id === selectedPresetId) ?? null,
        [presets, selectedPresetId],
    );
    const presetModified = useMemo(() => {
        if (!selectedPreset) return false;
        if (selectedPreset.battleRoyaleFormat !== royaleFormat) return true;
        if (selectedPreset.maxPlayers !== royaleMaxPlayers) return true;
        if (selectedPreset.rounds.length !== royaleRounds.length) return true;
        return selectedPreset.rounds.some(
            (r, i) =>
                r.eliminateCount !== royaleRounds[i]?.eliminateCount ||
                r.timeLimitSeconds !== royaleRounds[i]?.timeLimitSeconds,
        );
    }, [selectedPreset, royaleFormat, royaleMaxPlayers, royaleRounds]);

    const applyPreset = (preset: RoyalePreset) => {
        setSelectedPresetId(preset.id);
        setRoyaleFormat(preset.battleRoyaleFormat);
        setRoyaleMaxPlayers(preset.maxPlayers);
        setRoyaleRounds(preset.rounds.map((r) => ({ ...r })));
    };

    const onChangeMaxPlayers = (next: number) => {
        const clamped = Math.max(BR_MIN_PLAYERS, Math.min(BR_MAX_PLAYERS, Math.round(next)));
        setRoyaleMaxPlayers(clamped);
        setRoyaleRounds(buildDefaultRounds(clamped));
        setSelectedPresetId(null);
    };

    const updateRound = (index: number, patch: Partial<RoundConfig>) => {
        setRoyaleRounds((prev) =>
            prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
        );
        setSelectedPresetId((id) => (id ? id : null));
    };

    const addRound = () => {
        // Insert a new round before the last (1v1) round so the finale rule stays intact.
        setRoyaleRounds((prev) => {
            if (prev.length === 0) {
                return [
                    { timeLimitSeconds: 300, eliminateCount: 0 },
                    { timeLimitSeconds: 300, eliminateCount: 1 },
                ];
            }
            const finale = prev[prev.length - 1];
            const head = prev.slice(0, -1);
            return [...head, { timeLimitSeconds: 300, eliminateCount: 0 }, finale];
        });
        setSelectedPresetId(null);
    };

    const removeRound = (index: number) => {
        if (royaleRounds.length <= BR_MIN_ROUNDS) return;
        // Never allow removing the last (finale) round directly.
        if (index === royaleRounds.length - 1) return;
        setRoyaleRounds((prev) => prev.filter((_, i) => i !== index));
        setSelectedPresetId(null);
    };

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
        if (mode === 'BATTLE_ROYALE') {
            toast.error(
                'Battle Royale is lobby-only. Create a private game and share the invite code.',
            );
            return;
        }
        if (!requireCanPlay()) return;
        navigate('/matchmaking', { state: { config: getConfig() } });
    };

    const handleCreatePrivate = async () => {
        if (!requireCanPlay()) return;

        if (mode === 'BATTLE_ROYALE' && !royaleValid) {
            toast.error(royaleErrors[0]?.message ?? 'Invalid Battle Royale configuration.');
            return;
        }

        const payload: CreateBattleRequest = {
            mode,
            timeLimitMinutes,
            enabledSkills: enabledSkills.length > 0 ? enabledSkills : undefined,
            withInviteCode: true,
            preferredTopic: topic ?? undefined,
            preferredDifficulty: difficulty === 'ANY' ? undefined : difficulty,
        };

        if (mode === 'BATTLE_ROYALE') {
            payload.battleRoyaleFormat = royaleFormat;
            payload.maxPlayers = royaleMaxPlayers;
            payload.rounds = royaleRounds.map((r) => ({
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
        if (!requireCanPlay()) return;
        setIsJoining(true);
        try {
            const { data } = await api.post(`/battles/invite/${joinCode.trim()}/join`);
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

                        {/* Settings — generic (hidden for Battle Royale) */}
                        {mode !== 'BATTLE_ROYALE' && (
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
                        )}

                        {/* Battle Royale configurator */}
                        {mode === 'BATTLE_ROYALE' && (
                            <AnimateIn direction="up" delay={75}>
                                <Card>
                                    <CardContent className="space-y-6 p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <SectionHeader
                                                icon={<Crown className="h-4 w-4 text-primary" />}
                                                title="Battle Royale Settings"
                                                subtitle="Design your bracket: format, lobby size, and round-by-round eliminations."
                                            />
                                            {selectedPreset && (
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 border-primary/40 bg-primary/5 text-primary"
                                                >
                                                    {selectedPreset.name}
                                                    {presetModified ? ' • edited' : ''}
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Presets */}
                                        <div>
                                            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                <Sparkles className="h-3 w-3" />
                                                Presets
                                            </p>
                                            {presetsLoading ? (
                                                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    Loading presets…
                                                </div>
                                            ) : presetsError ? (
                                                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                                    {presetsError}
                                                </div>
                                            ) : presets.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                                    No server presets available. Configure a custom bracket below.
                                                </div>
                                            ) : (
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {presets.map((p) => {
                                                        const active = selectedPresetId === p.id;
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => applyPreset(p)}
                                                                className={`rounded-lg border-2 p-3 text-left transition-all ${active
                                                                    ? 'border-primary bg-primary/5'
                                                                    : 'border-border hover:border-primary/40'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-sm font-semibold">{p.name}</span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="h-4 shrink-0 px-1.5 text-[10px]"
                                                                    >
                                                                        {p.maxPlayers}p · {p.rounds.length} rounds
                                                                    </Badge>
                                                                </div>
                                                                <p className="mt-1 text-xs text-muted-foreground">
                                                                    {p.description}
                                                                </p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Format */}
                                        <div>
                                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Format
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {ROYALE_FORMATS.map((f) => {
                                                    const active = royaleFormat === f.value;
                                                    return (
                                                        <button
                                                            key={f.value}
                                                            onClick={() => {
                                                                setRoyaleFormat(f.value);
                                                                setSelectedPresetId(null);
                                                            }}
                                                            className={`rounded-lg border-2 p-3 text-left transition-all ${active
                                                                ? 'border-primary bg-primary/5'
                                                                : 'border-border hover:border-primary/40'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Layers className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                                                                <span className="text-sm font-semibold">{f.label}</span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-muted-foreground">
                                                                {f.description}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Lobby size */}
                                        <div>
                                            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                <Users className="h-3 w-3" />
                                                Lobby Size
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => onChangeMaxPlayers(royaleMaxPlayers - 1)}
                                                    disabled={royaleMaxPlayers <= BR_MIN_PLAYERS}
                                                    aria-label="Decrease lobby size"
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <input
                                                    type="number"
                                                    min={BR_MIN_PLAYERS}
                                                    max={BR_MAX_PLAYERS}
                                                    value={royaleMaxPlayers}
                                                    onChange={(e) => {
                                                        const n = parseInt(e.target.value, 10);
                                                        if (Number.isFinite(n)) onChangeMaxPlayers(n);
                                                    }}
                                                    className="w-20 rounded-md border border-input bg-background px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => onChangeMaxPlayers(royaleMaxPlayers + 1)}
                                                    disabled={royaleMaxPlayers >= BR_MAX_PLAYERS}
                                                    aria-label="Increase lobby size"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                                <span className="text-xs text-muted-foreground">
                                                    {BR_MIN_PLAYERS}–{BR_MAX_PLAYERS} players
                                                </span>
                                            </div>
                                            <p className="mt-2 text-[11px] text-muted-foreground">
                                                Changing lobby size resets round eliminations to a valid default.
                                            </p>
                                        </div>

                                        {/* Rounds */}
                                        <div>
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    <Layers className="h-3 w-3" />
                                                    Rounds ({royaleRounds.length})
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addRound}
                                                    disabled={royaleRounds.length >= royaleMaxPlayers - 1}
                                                >
                                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                                    Add Round
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {royaleRounds.map((r, i) => {
                                                    const isFinale = i === royaleRounds.length - 1;
                                                    const startPlayers = royaleProgression[i] ?? 0;
                                                    const endPlayers = Math.max(
                                                        0,
                                                        startPlayers - (r.eliminateCount || 0),
                                                    );
                                                    const roundErrors = royaleErrors.filter(
                                                        (e) => e.roundIndex === i,
                                                    );
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`rounded-lg border p-3 ${roundErrors.length > 0
                                                                ? 'border-red-500/50 bg-red-500/5'
                                                                : isFinale
                                                                    ? 'border-primary/40 bg-primary/5'
                                                                    : 'border-border'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                                        Round {i + 1}
                                                                    </span>
                                                                    {isFinale && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="h-4 border-primary/40 bg-primary/10 px-1.5 text-[10px] text-primary"
                                                                        >
                                                                            <Trophy className="mr-1 h-2.5 w-2.5" />
                                                                            Finale · 1v1
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {!isFinale && royaleRounds.length > BR_MIN_ROUNDS && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7"
                                                                        onClick={() => removeRound(i)}
                                                                        aria-label={`Remove round ${i + 1}`}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                                                <label className="block">
                                                                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                        Time limit (sec)
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min={BR_MIN_ROUND_SECONDS}
                                                                        max={BR_MAX_ROUND_SECONDS}
                                                                        value={r.timeLimitSeconds}
                                                                        onChange={(e) => {
                                                                            const n = parseInt(e.target.value, 10);
                                                                            updateRound(i, {
                                                                                timeLimitSeconds: Number.isFinite(n) ? n : 0,
                                                                            });
                                                                        }}
                                                                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                                    />
                                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                                        {ROUND_TIME_PRESETS.map((t) => (
                                                                            <button
                                                                                key={t}
                                                                                type="button"
                                                                                onClick={() => updateRound(i, { timeLimitSeconds: t })}
                                                                                className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${r.timeLimitSeconds === t
                                                                                    ? 'border-primary bg-primary/10 text-primary'
                                                                                    : 'border-border text-muted-foreground hover:border-primary/40'
                                                                                    }`}
                                                                            >
                                                                                {formatSeconds(t)}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </label>

                                                                <label className="block">
                                                                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                        Eliminations
                                                                    </span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={Math.max(0, startPlayers - 1)}
                                                                        value={r.eliminateCount}
                                                                        onChange={(e) => {
                                                                            const n = parseInt(e.target.value, 10);
                                                                            updateRound(i, {
                                                                                eliminateCount: Number.isFinite(n) ? n : 0,
                                                                            });
                                                                        }}
                                                                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                                    />
                                                                    <p className="mt-1 text-[10px] text-muted-foreground">
                                                                        Starts with {startPlayers}, ends with {endPlayers}
                                                                    </p>
                                                                </label>

                                                                <div className="flex items-end justify-end">
                                                                    <Badge variant="secondary" className="text-[10px]">
                                                                        {formatSeconds(r.timeLimitSeconds)}
                                                                    </Badge>
                                                                </div>
                                                            </div>

                                                            {roundErrors.map((err, ei) => (
                                                                <p
                                                                    key={ei}
                                                                    className="mt-2 flex items-start gap-1 text-[11px] text-red-500"
                                                                >
                                                                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                                                    {err.message}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Global BR errors (not attached to a specific round) */}
                                            {royaleErrors.filter((e) => e.roundIndex === undefined).length > 0 && (
                                                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                                                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Fix these before creating the lobby:
                                                    </p>
                                                    <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-red-500/90">
                                                        {royaleErrors
                                                            .filter((e) => e.roundIndex === undefined)
                                                            .map((err, ei) => (
                                                                <li key={ei}>{err.message}</li>
                                                            ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Problem selection hints (difficulty/topic) — still relevant for BR */}
                                        <Separator />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div>
                                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Preferred Difficulty
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {DIFFICULTIES.map((d) => (
                                                        <Chip
                                                            key={d.value}
                                                            active={difficulty === d.value}
                                                            onClick={() => setDifficulty(d.value)}
                                                        >
                                                            <span className={difficulty === d.value ? '' : d.color}>
                                                                {d.label}
                                                            </span>
                                                        </Chip>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Preferred Topic
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
                                        </div>
                                    </CardContent>
                                </Card>
                            </AnimateIn>
                        )}

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
                                            {mode === 'BATTLE_ROYALE' ? (
                                                <>
                                                    <SummaryRow
                                                        label="Format"
                                                        value={
                                                            ROYALE_FORMATS.find((f) => f.value === royaleFormat)?.label ??
                                                            royaleFormat
                                                        }
                                                    />
                                                    <SummaryRow
                                                        label="Lobby"
                                                        value={`${royaleMaxPlayers} players`}
                                                    />
                                                    <SummaryRow
                                                        label="Rounds"
                                                        value={`${royaleRounds.length}`}
                                                    />
                                                    <SummaryRow
                                                        label="Total time"
                                                        value={formatSeconds(royaleTotalSeconds)}
                                                    />
                                                    <SummaryRow
                                                        label="Eliminations"
                                                        value={`${royaleTotalElim} / ${royaleMaxPlayers - 1}`}
                                                    />
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className="text-muted-foreground">Progression</span>
                                                        <div className="flex flex-wrap justify-end gap-1">
                                                            {royaleRounds.map((r, i) => (
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
                                                    <SummaryRow label="Topic" value={topic ?? 'Any'} />
                                                </>
                                            ) : (
                                                <>
                                                    <SummaryRow label="Difficulty" value={diffMeta.label} />
                                                    <SummaryRow
                                                        label="Time"
                                                        value={`${timeLimitMinutes} min`}
                                                    />
                                                    <SummaryRow label="Topic" value={topic ?? 'Any'} />
                                                </>
                                            )}
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

                                        {mode === 'BATTLE_ROYALE' ? (
                                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-muted-foreground">
                                                <p className="flex items-center gap-1 font-medium text-primary">
                                                    <Crown className="h-3.5 w-3.5" />
                                                    Lobby-only mode
                                                </p>
                                                <p className="mt-1">
                                                    Battle Royale cannot be matchmade. Create a private lobby and share
                                                    the invite code with your players.
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
                                                {mode === 'BATTLE_ROYALE' ? 'Create' : 'OR'}
                                            </span>
                                        </div>

                                        {!inviteCode ? (
                                            <Button
                                                variant={mode === 'BATTLE_ROYALE' ? 'default' : 'outline'}
                                                className={mode === 'BATTLE_ROYALE' ? 'h-12 w-full text-base' : 'h-11 w-full'}
                                                onClick={handleCreatePrivate}
                                                disabled={
                                                    isCreatingPrivate ||
                                                    (mode === 'BATTLE_ROYALE' && !royaleValid)
                                                }
                                            >
                                                {isCreatingPrivate ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : mode === 'BATTLE_ROYALE' ? (
                                                    <Crown className="mr-2 h-4 w-4" />
                                                ) : (
                                                    <Link2 className="mr-2 h-4 w-4" />
                                                )}
                                                {mode === 'BATTLE_ROYALE'
                                                    ? 'Create Royale Lobby'
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
