import {
    ChevronDown,
    ChevronUp,
    Info,
    Minus,
    Plus,
    Trash2,
    Trophy,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AnimateIn } from '@/components/layout/AnimateIn';
import {
    CLAN_WARS_FORMATS,
    CW_MAX_ROUND_SECONDS,
    CW_MAX_TEAM_SIZE,
    CW_MIN_ROUND_SECONDS,
    CW_MIN_TEAM_SIZE,
    ROUND_TIME_PRESETS,
} from '../constants';
import { formatSeconds } from '../utils';
import type { PlayConfig } from '../usePlayConfig';
import { SectionHeader } from './SectionHeader';
import { DifficultyTopicGrid } from './RulesPanel';

export function ClanWarPanel({ cfg }: { cfg: PlayConfig }) {
    const [cwRulesExpanded, setCwRulesExpanded] = useState(false);

    return (
        <AnimateIn direction="up" delay={75}>
            <Card>
                <CardContent className="space-y-6 p-6">
                    <SectionHeader
                        icon={<Users className="h-4 w-4 text-primary" />}
                        title="Clan Wars Settings"
                        subtitle="Configure format, team size, and rounds. Rules mirror Battle Royale style."
                    />

                    {/* Presets */}
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Presets
                        </p>
                        {cfg.cwPresetsLoading ? (
                            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                Loading presets...
                            </div>
                        ) : cfg.cwPresetsError ? (
                            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                                {cfg.cwPresetsError}
                            </div>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                                {cfg.cwPresets.map((p) => {
                                    const active = cfg.cwPresetId === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => cfg.applyCwPreset(p)}
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
                                                    className="h-4 px-1.5 text-[10px]"
                                                >
                                                    {p.teamSize}v{p.teamSize} - {p.rounds.length}r
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
                            {CLAN_WARS_FORMATS.map((f) => {
                                const active = cfg.cwFormat === f.value;
                                return (
                                    <button
                                        key={f.value}
                                        onClick={() => cfg.onChangeCwFormat(f.value)}
                                        className={`rounded-lg border-2 p-3 text-left transition-all ${
                                            active
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/40'
                                        }`}
                                    >
                                        <span className="text-sm font-semibold">
                                            {f.label}
                                        </span>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {f.description}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* How it works */}
                    <CwRulesExplainer
                        format={cfg.cwFormat}
                        teamSize={cfg.cwTeamSize}
                        roundCount={cfg.cwRounds.length}
                        expanded={cwRulesExpanded}
                        onToggle={() => setCwRulesExpanded((v) => !v)}
                    />

                    {/* Team size */}
                    <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Users className="h-3 w-3" />
                            Team Size
                        </p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    cfg.onChangeCwTeamSize(
                                        Math.max(CW_MIN_TEAM_SIZE, cfg.cwTeamSize - 1),
                                    )
                                }
                                aria-label="Decrease team size"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <input
                                type="number"
                                min={CW_MIN_TEAM_SIZE}
                                max={CW_MAX_TEAM_SIZE}
                                value={cfg.cwTeamSize}
                                onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (Number.isFinite(n)) {
                                        cfg.onChangeCwTeamSize(
                                            Math.max(
                                                CW_MIN_TEAM_SIZE,
                                                Math.min(CW_MAX_TEAM_SIZE, n),
                                            ),
                                        );
                                    }
                                }}
                                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                    cfg.onChangeCwTeamSize(
                                        Math.min(CW_MAX_TEAM_SIZE, cfg.cwTeamSize + 1),
                                    )
                                }
                                aria-label="Increase team size"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {cfg.cwTeamSize}v{cfg.cwTeamSize} ({cfg.cwTeamSize * 2}{' '}
                                players)
                            </span>
                        </div>
                    </div>

                    {/* Rounds */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Rounds ({cfg.cwRounds.length})
                            </p>
                            <Button variant="outline" size="sm" onClick={cfg.addCwRound}>
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add Round
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {cfg.cwRounds.map((round, i) => (
                                <div key={i} className="rounded-lg border p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Round {i + 1}
                                        </span>
                                        {cfg.cwRounds.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => cfg.removeCwRound(i)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                    <label className="mt-2 block">
                                        <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                                            Time limit (sec)
                                        </span>
                                        <input
                                            type="number"
                                            min={CW_MIN_ROUND_SECONDS}
                                            max={CW_MAX_ROUND_SECONDS}
                                            value={round.timeLimitSeconds}
                                            onChange={(e) => {
                                                const n = parseInt(e.target.value, 10);
                                                cfg.updateCwRound(i, {
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
                                                        cfg.updateCwRound(i, {
                                                            timeLimitSeconds: t,
                                                        })
                                                    }
                                                    className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                                        round.timeLimitSeconds === t
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border text-muted-foreground hover:border-primary/40'
                                                    }`}
                                                >
                                                    {formatSeconds(t)}
                                                </button>
                                            ))}
                                        </div>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {cfg.cwErrors.length > 0 && (
                        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3">
                            <p className="mb-1 text-[11px] font-semibold text-red-500">
                                Fix these before creating:
                            </p>
                            <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-red-500/90">
                                {cfg.cwErrors.map((err) => (
                                    <li key={err}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}

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

function CwRulesExplainer({
    format,
    teamSize,
    roundCount,
    expanded,
    onToggle,
}: {
    format: 'SAME_PROBLEM' | 'SCORE_ATTACK';
    teamSize: number;
    roundCount: number;
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
                    <p className="text-[12px] text-muted-foreground">
                        Both teams solve the same round problem. The round can end early on
                        a full team sweep; otherwise it ends when the timer hits{' '}
                        <span className="font-medium text-foreground">0</span>.
                    </p>
                ) : (
                    <p className="text-[12px] text-muted-foreground">
                        Teams solve from the SCORE_ATTACK pool and earn cumulative points
                        across rounds. Rounds end only when the timer hits{' '}
                        <span className="font-medium text-foreground">0</span>.
                    </p>
                )}
            </div>

            {expanded && (
                <div className="space-y-4 border-t border-primary/15 px-3 py-3 text-[12px] text-muted-foreground">
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
                                    Teams play as{' '}
                                    <span className="font-medium text-foreground">
                                        {teamSize}v{teamSize}
                                    </span>{' '}
                                    for{' '}
                                    <span className="font-medium text-foreground">
                                        {roundCount}
                                    </span>{' '}
                                    round{roundCount === 1 ? '' : 's'}.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                    2
                                </span>
                                <span>
                                    There is{' '}
                                    <span className="font-medium text-foreground">
                                        no elimination
                                    </span>{' '}
                                    in Clan Wars; teams accumulate performance across rounds.
                                </span>
                            </li>
                            <li className="flex gap-2">
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                    3
                                </span>
                                <span>
                                    After each round, the lobby enters{' '}
                                    <span className="font-medium text-foreground">
                                        intermission
                                    </span>{' '}
                                    and every player must ready up to start the next round.
                                </span>
                            </li>
                        </ol>
                    </div>

                    <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                            Round Winner
                        </p>
                        {format === 'SAME_PROBLEM' ? (
                            <ul className="space-y-1 pl-1">
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    <span>
                                        Team with more{' '}
                                        <span className="font-medium text-foreground">
                                            full-pass solves
                                        </span>{' '}
                                        wins the round.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                                    <span>
                                        If tied, higher total{' '}
                                        <span className="font-medium text-foreground">
                                            tests passed
                                        </span>{' '}
                                        breaks the tie.
                                    </span>
                                </li>
                            </ul>
                        ) : (
                            <ul className="space-y-1 pl-1">
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    <span>
                                        Team with more{' '}
                                        <span className="font-medium text-foreground">
                                            round points
                                        </span>{' '}
                                        wins the round.
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                                    <span>
                                        Exact point tie means no round winner is assigned.
                                    </span>
                                </li>
                            </ul>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.05] px-2 py-1.5 text-[11px] text-foreground">
                        <Trophy className="h-3 w-3 shrink-0 text-primary" />
                        <span>
                            Match winner is decided by{' '}
                            <span className="font-semibold">cumulative team points</span>,
                            then <span className="font-semibold">rounds won</span> as the
                            tie-break.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
