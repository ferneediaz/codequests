import {
    AlertCircle,
    ChevronDown,
    ChevronUp,
    CircleDot,
    Crown,
    Info,
    Layers,
    Loader2,
    Minus,
    Plus,
    ShieldCheck,
    Sparkles,
    Trash2,
    Trophy,
    UserX,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    BR_MAX_PLAYERS,
    BR_MAX_ROUND_SECONDS,
    BR_MIN_PLAYERS,
    BR_MIN_ROUNDS,
    BR_MIN_ROUND_SECONDS,
    ROUND_TIME_PRESETS,
    ROYALE_FORMATS,
} from '../constants';
import { formatSeconds } from '../utils';
import type { PlayConfig } from '../usePlayConfig';
import { SectionHeader } from './SectionHeader';
import { DifficultyTopicGrid } from './RulesPanel';

export function BattleRoyalePanel({ cfg }: { cfg: PlayConfig }) {
    const [royaleRulesExpanded, setRoyaleRulesExpanded] = useState(false);

    return (
        <AnimateIn direction="up" delay={75}>
            <Card>
                <CardContent className="space-y-6 p-6">
                    <div className="flex items-start justify-between gap-4">
                        <SectionHeader
                            icon={<Crown className="h-4 w-4 text-primary" />}
                            title="Battle Royale Settings"
                            subtitle="Design your bracket: format, lobby size, and round-by-round eliminations."
                        />
                        {cfg.selectedPreset && (
                            <Badge
                                variant="outline"
                                className="shrink-0 border-primary/40 bg-primary/5 text-primary"
                            >
                                {cfg.selectedPreset.name}
                                {cfg.presetModified ? ' • edited' : ''}
                            </Badge>
                        )}
                    </div>

                    {/* Presets */}
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Sparkles className="h-3 w-3" />
                            Presets
                        </p>
                        {cfg.presetsLoading ? (
                            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Loading presets…
                            </div>
                        ) : cfg.presetsError ? (
                            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                {cfg.presetsError}
                            </div>
                        ) : cfg.presets.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                No server presets available. Configure a custom bracket below.
                            </div>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {cfg.presets.map((p) => {
                                    const active = cfg.selectedPresetId === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => cfg.applyPreset(p)}
                                            className={`rounded-lg border-2 p-3 text-left transition-all ${
                                                active
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-primary/40'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-semibold">
                                                    {p.name}
                                                </span>
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
                                const active = cfg.royaleFormat === f.value;
                                return (
                                    <button
                                        key={f.value}
                                        onClick={() => cfg.onChangeRoyaleFormat(f.value)}
                                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                                            active
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Layers
                                                className={`h-4 w-4 ${
                                                    active
                                                        ? 'text-primary'
                                                        : 'text-muted-foreground'
                                                }`}
                                            />
                                            <span className="text-sm font-semibold">
                                                {f.label}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {f.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* How it works */}
                    <RoyaleRulesExplainer
                        format={cfg.royaleFormat}
                        expanded={royaleRulesExpanded}
                        onToggle={() => setRoyaleRulesExpanded((v) => !v)}
                    />

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
                                onClick={() => cfg.onChangeMaxPlayers(cfg.royaleMaxPlayers - 1)}
                                disabled={cfg.royaleMaxPlayers <= BR_MIN_PLAYERS}
                                aria-label="Decrease lobby size"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <input
                                type="number"
                                min={BR_MIN_PLAYERS}
                                max={BR_MAX_PLAYERS}
                                value={cfg.royaleMaxPlayers}
                                onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (Number.isFinite(n)) cfg.onChangeMaxPlayers(n);
                                }}
                                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => cfg.onChangeMaxPlayers(cfg.royaleMaxPlayers + 1)}
                                disabled={cfg.royaleMaxPlayers >= BR_MAX_PLAYERS}
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
                                Rounds ({cfg.royaleRounds.length})
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={cfg.addRound}
                                disabled={
                                    cfg.royaleRounds.length >= cfg.royaleMaxPlayers - 1
                                }
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add Round
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {cfg.royaleRounds.map((r, i) => {
                                const isFinale = i === cfg.royaleRounds.length - 1;
                                const startPlayers = cfg.royaleProgression[i] ?? 0;
                                const endPlayers = Math.max(
                                    0,
                                    startPlayers - (r.eliminateCount || 0),
                                );
                                const roundErrors = cfg.royaleErrors.filter(
                                    (e) => e.roundIndex === i,
                                );
                                return (
                                    <div
                                        key={i}
                                        className={`rounded-lg border p-3 ${
                                            roundErrors.length > 0
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
                                            {!isFinale &&
                                                cfg.royaleRounds.length > BR_MIN_ROUNDS && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => cfg.removeRound(i)}
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
                                                        cfg.updateRound(i, {
                                                            timeLimitSeconds: Number.isFinite(n)
                                                                ? n
                                                                : 0,
                                                        });
                                                    }}
                                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {ROUND_TIME_PRESETS.map((t) => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() =>
                                                                cfg.updateRound(i, {
                                                                    timeLimitSeconds: t,
                                                                })
                                                            }
                                                            className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                                                r.timeLimitSeconds === t
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
                                                        cfg.updateRound(i, {
                                                            eliminateCount: Number.isFinite(n)
                                                                ? n
                                                                : 0,
                                                        });
                                                    }}
                                                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                                />
                                                <p className="mt-1 text-[10px] text-muted-foreground">
                                                    Starts with {startPlayers}, ends with{' '}
                                                    {endPlayers}
                                                </p>
                                            </label>

                                            <div className="flex items-end justify-end">
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px]"
                                                >
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

                        {cfg.royaleErrors.filter((e) => e.roundIndex === undefined).length >
                            0 && (
                            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                                <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
                                    <AlertCircle className="h-3 w-3" />
                                    Fix these before creating the lobby:
                                </p>
                                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-red-500/90">
                                    {cfg.royaleErrors
                                        .filter((e) => e.roundIndex === undefined)
                                        .map((err, ei) => (
                                            <li key={ei}>{err.message}</li>
                                        ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <Separator />
                    <DifficultyTopicGrid
                        difficulty={cfg.difficulty}
                        onChangeDifficulty={cfg.setDifficulty}
                        topic={cfg.topic}
                        onChangeTopic={cfg.setTopic}
                    />
                </CardContent>
            </Card>
        </AnimateIn>
    );
}

function RoyaleRulesExplainer({
    format,
    expanded,
    onToggle,
}: {
    format: 'SAME_PROBLEM' | 'SCORE_ATTACK';
    expanded: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03]">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-2 rounded-xl p-3 text-left transition-colors hover:bg-primary/[0.05]"
            >
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">How it works</span>
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                        ·{' '}
                        {format === 'SAME_PROBLEM'
                            ? 'Same Problem rules'
                            : 'Score Attack rules'}
                    </span>
                </div>
                {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>

            <div className="px-3 pb-3">
                {format === 'SAME_PROBLEM' ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            Fully solved
                        </span>
                        <span className="text-[11px] text-muted-foreground">→</span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <CircleDot className="h-3 w-3" />
                            Attempted
                        </span>
                        <span className="text-[11px] text-muted-foreground">→</span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                            <UserX className="h-3 w-3" />
                            No submission
                        </span>
                        <span className="ml-1 text-[11px] text-muted-foreground">
                            (safest → out first)
                        </span>
                    </div>
                ) : (
                    <p className="text-[12px] text-muted-foreground">
                        Lowest cumulative points is eliminated each round. Round ends when
                        the timer hits{' '}
                        <span className="font-medium text-foreground">0</span>.
                    </p>
                )}
            </div>

            {expanded && (
                <div className="space-y-4 border-t border-primary/15 px-3 py-3 text-[12px] text-muted-foreground">
                    {format === 'SAME_PROBLEM' ? (
                        <SameProblemRules />
                    ) : (
                        <ScoreAttackRules />
                    )}

                    <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.05] px-2 py-1.5 text-[11px] text-foreground">
                        <Trophy className="h-3 w-3 shrink-0 text-primary" />
                        <span>
                            The final round is always a{' '}
                            <span className="font-semibold">1v1 showdown</span>.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

function SameProblemRules() {
    return (
        <>
            <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Round Flow
                </p>
                <ol className="space-y-1 pl-1">
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            1
                        </span>
                        <span>
                            Every surviving player gets the{' '}
                            <span className="font-medium text-foreground">same problem</span>
                            .
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            2
                        </span>
                        <span>
                            Round ends when enough players fully solve{' '}
                            <span className="text-muted-foreground/80">
                                (remaining − eliminations)
                            </span>{' '}
                            <span className="font-medium text-foreground">or</span> the timer
                            hits 0.
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            3
                        </span>
                        <span>
                            The configured number of players is eliminated from the bottom.
                        </span>
                    </li>
                </ol>
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Safety Ladder
                </p>
                <div className="space-y-1.5">
                    <div className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-2">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <div>
                            <p className="font-medium text-foreground">
                                Fully solved{' '}
                                <span className="text-muted-foreground">— safest</span>
                            </p>
                            <p className="text-[11px]">
                                Ties broken by{' '}
                                <span className="font-medium text-foreground">
                                    earliest full-pass time
                                </span>
                                .
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-2">
                        <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <div>
                            <p className="font-medium text-foreground">
                                Attempted, not fully passing
                            </p>
                            <p className="text-[11px]">
                                More{' '}
                                <span className="font-medium text-foreground">
                                    tests passed
                                </span>{' '}
                                wins ties; then{' '}
                                <span className="font-medium text-foreground">
                                    earlier submission
                                </span>
                                .
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 rounded-md border border-red-500/20 bg-red-500/[0.04] p-2">
                        <UserX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        <div>
                            <p className="font-medium text-foreground">
                                No submission — eliminated first
                            </p>
                            <p className="text-[11px]">
                                Deterministic tiebreak by username.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function ScoreAttackRules() {
    return (
        <>
            <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Round Flow
                </p>
                <ol className="space-y-1 pl-1">
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            1
                        </span>
                        <span>
                            Pick problems from the round{"'"}s pool and solve{' '}
                            <span className="font-medium text-foreground">
                                as many as you can
                            </span>
                            .
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            2
                        </span>
                        <span>
                            Harder problems are worth more points. Points{' '}
                            <span className="font-medium text-foreground">
                                carry across rounds
                            </span>
                            .
                        </span>
                    </li>
                    <li className="flex gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                            3
                        </span>
                        <span>
                            Round ends{' '}
                            <span className="font-medium text-foreground">only</span> when
                            the timer hits 0 — no early finish.
                        </span>
                    </li>
                </ol>
            </div>

            <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Who Gets Eliminated
                </p>
                <ul className="space-y-1 pl-1">
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                        <span>
                            Lowest{' '}
                            <span className="font-medium text-foreground">
                                cumulative points
                            </span>{' '}
                            is eliminated.
                        </span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>
                            Tiebreak 1: fewer points{' '}
                            <span className="font-medium text-foreground">this round</span>.
                        </span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>
                            Tiebreak 2:{' '}
                            <span className="font-medium text-foreground">later</span> last
                            submission loses.
                        </span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>Tiebreak 3: deterministic username tiebreak.</span>
                    </li>
                </ul>
            </div>
        </>
    );
}
