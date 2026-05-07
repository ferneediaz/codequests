import { Clock, Hash, Layers, Shapes, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { QuickPlayPreset } from '@/types/api';
import { SKILLS } from '../../play/constants';
import {
    describeDifficulty,
    describeMode,
    describeTime,
    describeTopic,
} from '../utils';

export function PresetSummaryCard({ preset }: { preset: QuickPlayPreset }) {
    const { config } = preset;
    return (
        <Card className="border-primary/30 bg-gradient-to-b from-card to-card/60">
            <CardContent className="space-y-4 p-6">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Active preset
                    </p>
                    <h2 className="mt-1 text-xl font-bold">{preset.name}</h2>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                    <SummaryItem icon={Layers} label="Mode" value={describeMode(config)} />
                    <SummaryItem
                        icon={Shapes}
                        label="Difficulty"
                        value={describeDifficulty(config)}
                    />
                    <SummaryItem
                        icon={Clock}
                        label="Time"
                        value={describeTime(config)}
                    />
                    <SummaryItem
                        icon={Hash}
                        label="Topic"
                        value={describeTopic(config)}
                    />
                </dl>
                <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Zap className="h-3 w-3" />
                        Skills
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {config.enabledSkills?.length ? (
                            config.enabledSkills.map((s) => (
                                <Badge key={s} variant="secondary" className="text-[10px]">
                                    {SKILLS.find((sk) => sk.type === s)?.label ?? s}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-sm font-medium">None</span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SummaryItem({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Icon className="h-3 w-3" />
                {label}
            </dt>
            <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
        </div>
    );
}
