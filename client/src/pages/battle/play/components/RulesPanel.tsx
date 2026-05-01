import { Target, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimateIn } from '@/components/layout/AnimateIn';
import type { Difficulty } from '@/types/api';
import { DIFFICULTIES, TIME_LIMITS, TOPICS } from '../constants';
import { SectionHeader } from './SectionHeader';
import { Chip } from './Chip';

interface RulesPanelProps {
    difficulty: Difficulty | 'ANY';
    onChangeDifficulty: (d: Difficulty | 'ANY') => void;
    timeLimitMinutes: number;
    onChangeTimeLimit: (t: number) => void;
    topic: string | null;
    onChangeTopic: (t: string | null) => void;
}

export function RulesPanel({
    difficulty,
    onChangeDifficulty,
    timeLimitMinutes,
    onChangeTimeLimit,
    topic,
    onChangeTopic,
}: RulesPanelProps) {
    return (
        <AnimateIn direction="up" delay={75}>
            <Card>
                <CardContent className="space-y-6 p-6">
                    <SectionHeader
                        icon={<Target className="h-4 w-4 text-primary" />}
                        title="Settings"
                    />

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Difficulty
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {DIFFICULTIES.map((d) => (
                                <Chip
                                    key={d.value}
                                    active={difficulty === d.value}
                                    onClick={() => onChangeDifficulty(d.value)}
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
                                    onClick={() => onChangeTimeLimit(t)}
                                >
                                    {t} min
                                </Chip>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Topic <span className="normal-case">(optional)</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Chip
                                active={topic === null}
                                onClick={() => onChangeTopic(null)}
                            >
                                Any
                            </Chip>
                            {TOPICS.map((t) => (
                                <Chip
                                    key={t}
                                    active={topic === t}
                                    onClick={() => onChangeTopic(t)}
                                >
                                    {t}
                                </Chip>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </AnimateIn>
    );
}

interface DifficultyTopicGridProps {
    difficulty: Difficulty | 'ANY';
    onChangeDifficulty: (d: Difficulty | 'ANY') => void;
    topic: string | null;
    onChangeTopic: (t: string | null) => void;
}

/** Difficulty + Topic two-column grid used inside the BR/CW configurators. */
export function DifficultyTopicGrid({
    difficulty,
    onChangeDifficulty,
    topic,
    onChangeTopic,
}: DifficultyTopicGridProps) {
    return (
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
                            onClick={() => onChangeDifficulty(d.value)}
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
            <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Preferred Topic
                </p>
                <div className="flex flex-wrap gap-2">
                    <Chip active={topic === null} onClick={() => onChangeTopic(null)}>
                        Any
                    </Chip>
                    {TOPICS.map((t) => (
                        <Chip
                            key={t}
                            active={topic === t}
                            onClick={() => onChangeTopic(t)}
                        >
                            {t}
                        </Chip>
                    ))}
                </div>
            </div>
        </div>
    );
}
