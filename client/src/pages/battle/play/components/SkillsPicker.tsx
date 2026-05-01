import { Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimateIn } from '@/components/layout/AnimateIn';
import type { SkillType } from '@/types/api';
import { SKILLS } from '../constants';
import { SectionHeader } from './SectionHeader';

interface SkillsPickerProps {
    enabledSkills: SkillType[];
    onToggleSkill: (skill: SkillType) => void;
    onToggleAll: () => void;
}

export function SkillsPicker({
    enabledSkills,
    onToggleSkill,
    onToggleAll,
}: SkillsPickerProps) {
    return (
        <AnimateIn direction="up" delay={150}>
            <Card>
                <CardContent className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <SectionHeader
                            icon={<Flame className="h-4 w-4 text-primary" />}
                            title="Battle Skills"
                            subtitle="Toggle power-ups available during the match"
                        />
                        <Button variant="outline" size="sm" onClick={onToggleAll}>
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
                                    onClick={() => onToggleSkill(skill.type)}
                                    className={`group flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${
                                        enabled
                                            ? 'border-primary bg-primary/5'
                                            : 'border-border bg-background/40 hover:border-primary/40'
                                    }`}
                                >
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                                            enabled
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
                                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                                    enabled
                                                        ? 'text-primary'
                                                        : 'text-muted-foreground/60'
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
    );
}
