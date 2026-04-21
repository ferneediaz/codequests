import { useState, useEffect } from 'react';
import { Snowflake, Shuffle, Clock, Cloud } from 'lucide-react';
import type { SkillType } from '@/types/api';

interface ActiveEffect {
    skillType: SkillType;
    expiresAt: number;
}

interface SkillEffectOverlayProps {
    activeEffects: ActiveEffect[];
}

type OverlayConfig = {
    icon: React.ElementType;
    label: string;
    color: string;
    bgClass: string;
};

const EFFECT_CONFIG: Partial<Record<SkillType, OverlayConfig>> = {
    FREEZE: {
        icon: Snowflake,
        label: 'Frozen!',
        color: 'text-cyan-400',
        bgClass: 'bg-cyan-500/20 border-cyan-500/40',
    },
    SCRAMBLE: {
        icon: Shuffle,
        label: 'Scrambled!',
        color: 'text-orange-400',
        bgClass: 'bg-orange-500/20 border-orange-500/40',
    },
    TIME_STEAL: {
        icon: Clock,
        label: '-5:00 stolen!',
        color: 'text-red-400',
        bgClass: 'bg-red-500/20 border-red-500/40',
    },
    FOG_OF_WAR: {
        icon: Cloud,
        label: 'Fog of War!',
        color: 'text-gray-300',
        bgClass: 'bg-gray-500/20 border-gray-500/40',
    },
};

export function SkillEffectOverlay({ activeEffects }: SkillEffectOverlayProps) {
    const [, setTick] = useState(0);

    // Re-render every second to update countdowns
    useEffect(() => {
        if (activeEffects.length === 0) return;
        const interval = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [activeEffects.length]);

    if (activeEffects.length === 0) return null;

    return (
        <>
            {activeEffects.map((effect) => {
                const config = EFFECT_CONFIG[effect.skillType];
                if (!config) return null;
                const Icon = config.icon;
                const secondsLeft = Math.max(
                    0,
                    Math.ceil((effect.expiresAt - Date.now()) / 1000),
                );
                const isFog = effect.skillType === 'FOG_OF_WAR';
                const isFreeze = effect.skillType === 'FREEZE';
                const isScramble = effect.skillType === 'SCRAMBLE';
                const isTimeSteal = effect.skillType === 'TIME_STEAL';

                return (
                    <div
                        key={effect.skillType}
                        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
                    >
                        {/* Tinted / blur overlays per skill */}
                        {isFreeze && (
                            <div className="absolute inset-0 bg-cyan-500/15 backdrop-blur-[2px]" />
                        )}
                        {isScramble && (
                            <div className="absolute inset-0 bg-orange-500/10" />
                        )}
                        {isTimeSteal && (
                            <div className="absolute inset-0 animate-pulse bg-red-500/20" />
                        )}
                        {isFog && (
                            <div className="absolute inset-0 animate-fog-pulse bg-black/10" />
                        )}

                        {/* Center badge — suppressed for FOG_OF_WAR (annoy, don't inform) */}
                        {!isFog && (
                            <div
                                className={`relative flex flex-col items-center gap-2 rounded-xl border px-6 py-4 shadow-lg ${config.bgClass}`}
                            >
                                <Icon className={`h-8 w-8 ${config.color} animate-pulse`} />
                                <span className={`text-lg font-bold ${config.color}`}>
                                    {config.label}
                                </span>
                                {secondsLeft > 0 && !isTimeSteal && (
                                    <span className="font-mono text-sm text-muted-foreground">
                                        {secondsLeft}s
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
