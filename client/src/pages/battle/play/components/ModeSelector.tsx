import { Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimateIn } from '@/components/layout/AnimateIn';
import type { BattleMode } from '@/types/api';
import { MODES } from '../constants';
import { SectionHeader } from './SectionHeader';

interface ModeSelectorProps {
    mode: BattleMode;
    onChange: (mode: BattleMode) => void;
}

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
    return (
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
                                    onClick={() => onChange(m.value)}
                                    className={`group relative overflow-hidden rounded-xl border-2 p-5 text-left transition-all ${
                                        active
                                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                            : 'border-border bg-background/40 hover:border-primary/40 hover:bg-card/60'
                                    }`}
                                >
                                    {active && (
                                        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
                                    )}
                                    <div
                                        className={`relative mb-3 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${
                                            active
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
    );
}
