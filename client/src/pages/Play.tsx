import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Swords,
    Users,
    Crown,
    ChevronRight,
    ChevronLeft,
    Snowflake,
    Shuffle,
    EyeOff,
    Clock,
    CloudFog,
    Link2,
    Copy,
    Check,
    Loader2,
    Zap,
} from 'lucide-react';
import type {
    BattleMode,
    Difficulty,
    SkillType,
    MatchConfig,
} from '@/types/api';
import api from '@/services/api';
import { toast } from 'sonner';

const MODES: { value: BattleMode; label: string; icon: React.ReactNode; description: string }[] = [
    {
        value: 'ONE_V_ONE',
        label: '1v1 Duel',
        icon: <Swords className="h-8 w-8" />,
        description: 'Head-to-head battle. Solve the problem faster than your opponent.',
    },
    {
        value: 'BATTLE_ROYALE',
        label: 'Battle Royale',
        icon: <Crown className="h-8 w-8" />,
        description: 'Last coder standing. 6-8 players, elimination rounds.',
    },
    {
        value: 'GROUP',
        label: 'Group Battle',
        icon: <Users className="h-8 w-8" />,
        description: 'Team up with friends and battle another squad.',
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

const SKILLS: { type: SkillType; label: string; icon: React.ReactNode; description: string }[] = [
    {
        type: 'FREEZE',
        label: 'Freeze',
        icon: <Snowflake className="h-5 w-5" />,
        description: "Lock opponent's editor for 10 seconds",
    },
    {
        type: 'SCRAMBLE',
        label: 'Scramble',
        icon: <Shuffle className="h-5 w-5" />,
        description: "Shuffle opponent's code lines",
    },
    {
        type: 'BLIND',
        label: 'Blind',
        icon: <EyeOff className="h-5 w-5" />,
        description: "Hide opponent's test results until next submit",
    },
    {
        type: 'TIME_STEAL',
        label: 'Time Steal',
        icon: <Clock className="h-5 w-5" />,
        description: 'Steal 60 seconds from opponent',
    },
    {
        type: 'FOG_OF_WAR',
        label: 'Fog of War',
        icon: <CloudFog className="h-5 w-5" />,
        description: "Blur opponent's screen for 20 seconds",
    },
];

const TOTAL_STEPS = 4;

export default function Play() {
    const navigate = useNavigate();

    // Wizard state
    const [step, setStep] = useState(1);

    // Config state
    const [mode, setMode] = useState<BattleMode>('ONE_V_ONE');
    const [difficulty, setDifficulty] = useState<Difficulty | 'ANY'>('ANY');
    const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
    const [topic, setTopic] = useState<string | null>(null);
    const [enabledSkills, setEnabledSkills] = useState<SkillType[]>([]);

    // Step 4 state
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
        if (enabledSkills.length === SKILLS.length) {
            setEnabledSkills([]);
        } else {
            setEnabledSkills(SKILLS.map((s) => s.type));
        }
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
        // We need to get the battle ID from the invite code
        api.get(`/battles/invite/${inviteCode}`).then(({ data }) => {
            navigate(`/battle/${data.id}`);
        });
    };

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground">Create Game</h1>
                <p className="mt-1 text-muted-foreground">
                    Configure your battle settings
                </p>
            </div>

            {/* Step Indicator */}
            <div className="mb-8 flex items-center justify-center gap-2">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
                    <div key={s} className="flex items-center gap-2">
                        <button
                            onClick={() => s < step && setStep(s)}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${s === step
                                ? 'bg-primary text-primary-foreground'
                                : s < step
                                    ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            {s}
                        </button>
                        {s < TOTAL_STEPS && (
                            <div
                                className={`h-0.5 w-8 ${s < step ? 'bg-primary/40' : 'bg-muted'
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Labels */}
            <div className="mb-8 flex justify-between text-xs text-muted-foreground px-2">
                <span className={step === 1 ? 'text-primary font-medium' : ''}>Mode</span>
                <span className={step === 2 ? 'text-primary font-medium' : ''}>Settings</span>
                <span className={step === 3 ? 'text-primary font-medium' : ''}>Skills</span>
                <span className={step === 4 ? 'text-primary font-medium' : ''}>Play</span>
            </div>

            {/* Step 1: Mode Selection */}
            {step === 1 && (
                <div className="space-y-4">
                    {MODES.map((m) => (
                        <button
                            key={m.value}
                            onClick={() => setMode(m.value)}
                            className={`w-full rounded-lg border-2 p-6 text-left transition-colors ${mode === m.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/30'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div
                                    className={`${mode === m.value
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                        }`}
                                >
                                    {m.icon}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {m.label}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {m.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Step 2: Settings */}
            {step === 2 && (
                <div className="space-y-6">
                    {/* Difficulty */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Difficulty Preference</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {DIFFICULTIES.map((d) => (
                                    <button
                                        key={d.value}
                                        onClick={() => setDifficulty(d.value)}
                                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${difficulty === d.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                                            }`}
                                    >
                                        <span className={difficulty === d.value ? '' : d.color}>
                                            {d.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Time Limit */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Time Limit</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {TIME_LIMITS.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeLimitMinutes(t)}
                                        className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${timeLimitMinutes === t
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                                            }`}
                                    >
                                        {t} min
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Topic */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                                Topic Preference{' '}
                                <span className="text-muted-foreground font-normal">(optional)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setTopic(null)}
                                    className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${topic === null
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                                        }`}
                                >
                                    Any
                                </button>
                                {TOPICS.map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setTopic(t)}
                                        className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${topic === t
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border hover:border-muted-foreground/30 text-muted-foreground'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Step 3: Skills */}
            {step === 3 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Toggle skills that can be used during the battle
                        </p>
                        <Button variant="outline" size="sm" onClick={toggleAllSkills}>
                            {enabledSkills.length === SKILLS.length
                                ? 'Disable All'
                                : 'Enable All'}
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {SKILLS.map((skill) => {
                            const enabled = enabledSkills.includes(skill.type);
                            return (
                                <button
                                    key={skill.type}
                                    onClick={() => toggleSkill(skill.type)}
                                    className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${enabled
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-muted-foreground/30'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={
                                                enabled
                                                    ? 'text-primary'
                                                    : 'text-muted-foreground'
                                            }
                                        >
                                            {skill.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-foreground">
                                                    {skill.label}
                                                </h3>
                                                {enabled && (
                                                    <Badge variant="default" className="text-xs">
                                                        ON
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {skill.description}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step 4: Play / Create */}
            {step === 4 && (
                <div className="space-y-6">
                    {/* Config Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Game Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Mode</span>
                                    <p className="font-medium">
                                        {MODES.find((m) => m.value === mode)?.label}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Difficulty</span>
                                    <p className="font-medium">
                                        {DIFFICULTIES.find((d) => d.value === difficulty)?.label}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Time Limit</span>
                                    <p className="font-medium">{timeLimitMinutes} minutes</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Topic</span>
                                    <p className="font-medium">{topic ?? 'Any'}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-muted-foreground">Skills</span>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {enabledSkills.length === 0 ? (
                                            <span className="text-sm font-medium">None</span>
                                        ) : (
                                            enabledSkills.map((s) => (
                                                <Badge key={s} variant="secondary" className="text-xs">
                                                    {SKILLS.find((sk) => sk.type === s)?.label}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Find Match */}
                    <Button
                        className="h-14 w-full text-lg"
                        size="lg"
                        onClick={handleFindMatch}
                    >
                        <Zap className="mr-2 h-5 w-5" />
                        Find Match
                    </Button>

                    <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                            OR
                        </span>
                    </div>

                    {/* Create Private Game */}
                    {!inviteCode ? (
                        <Button
                            variant="outline"
                            className="h-12 w-full"
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
                        <Card className="border-primary/30">
                            <CardContent className="pt-4">
                                <p className="mb-3 text-sm text-muted-foreground">
                                    Share this code with your friends:
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 rounded-md bg-muted px-4 py-3 text-center text-lg font-mono font-bold tracking-widest">
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
                                    className="mt-3 w-full"
                                    variant="secondary"
                                    onClick={handleGoToBattle}
                                >
                                    Go to Battle Lobby
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <div className="relative">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                            OR
                        </span>
                    </div>

                    {/* Join by Code */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="Enter invite code"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                            className="flex-1 rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                            variant="outline"
                            onClick={handleJoinByCode}
                            disabled={!joinCode.trim() || isJoining}
                        >
                            {isJoining ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Join
                        </Button>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
                <Button
                    variant="ghost"
                    onClick={() => (step === 1 ? navigate('/dashboard') : setStep(step - 1))}
                >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {step === 1 ? 'Back to Dashboard' : 'Back'}
                </Button>

                {step < TOTAL_STEPS && (
                    <Button onClick={() => setStep(step + 1)}>
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
