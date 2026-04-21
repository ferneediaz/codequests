import { Snowflake, Shuffle, Clock, Cloud, Lock } from 'lucide-react';
import type { SkillType } from '@/types/api';

const SKILL_CONFIG: Partial<Record<
    SkillType,
    { icon: React.ElementType; label: string; description: string }
>> = {
    FREEZE: {
        icon: Snowflake,
        label: 'Freeze',
        description: "Freeze opponent's editor for 10 seconds",
    },
    SCRAMBLE: {
        icon: Shuffle,
        label: 'Scramble',
        description: "Shuffle opponent's code (they can't undo!)",
    },
    TIME_STEAL: {
        icon: Clock,
        label: 'Time Steal',
        description: 'Steal 5 minutes from your opponent',
    },
    FOG_OF_WAR: {
        icon: Cloud,
        label: 'Fog of War',
        description: "Pulsating blur over opponent's screen",
    },
};

interface SkillBarProps {
    enabledSkills: SkillType[];
    usedSkills: SkillType[];
    opponentUserId: string;
    onUseSkill: (skillType: SkillType, targetUserId: string) => void;
    unlocked: boolean;
}

export function SkillBar({
    enabledSkills,
    usedSkills,
    opponentUserId,
    onUseSkill,
    unlocked,
}: SkillBarProps) {
    if (enabledSkills.length === 0) return null;

    return (
        <div className="flex items-center gap-1">
            {enabledSkills.map((skillType) => {
                const config = SKILL_CONFIG[skillType];
                if (!config) return null; // BLIND and other deprecated skills
                const Icon = config.icon;
                const isUsed = usedSkills.includes(skillType);
                const isLocked = !unlocked;
                const disabled = isUsed || isLocked;

                return (
                    <div key={skillType} className="group relative">
                        <button
                            onClick={() => onUseSkill(skillType, opponentUserId)}
                            disabled={disabled}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-all ${
                                disabled
                                    ? 'cursor-not-allowed border-border bg-muted/30 text-muted-foreground opacity-50'
                                    : 'border-primary/30 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/20'
                            }`}
                        >
                            {isLocked && !isUsed ? (
                                <Lock className="h-3.5 w-3.5" />
                            ) : (
                                <Icon className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">{config.label}</span>
                        </button>

                        {/* Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="whitespace-nowrap rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md border border-border">
                                <div className="font-semibold">{config.label}</div>
                                <div className="text-muted-foreground">
                                    {config.description}
                                </div>
                                {isUsed && (
                                    <div className="mt-1 text-yellow-400">Already used</div>
                                )}
                                {isLocked && !isUsed && (
                                    <div className="mt-1 text-orange-400">
                                        Pass 1 test case to unlock
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
