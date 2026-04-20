import { useState, useEffect } from 'react';
import { Snowflake, EyeOff, Shuffle, Clock, Cloud } from 'lucide-react';
import type { SkillType } from '@/types/api';

interface ActiveEffect {
    skillType: SkillType;
    expiresAt: number;
}

interface SkillEffectOverlayProps {
    activeEffects: ActiveEffect[];
}

const EFFECT_CONFIG: Record<
    SkillType,
    { icon: React.ElementType; label: string; color: string; bgClass: string }
> = {
    FREEZE: {
        icon: Snowflake,
        label: 'Frozen!',
        color: 'text-cyan-400',
        bgClass: 'bg-cyan-500/20 border-cyan-500/40',
    },
    BLIND: {
        icon: EyeOff,
        label: 'Blinded!',
        color: 'text-purple-400',
        bgClass: 'bg-purple-500/20 border-purple-500/40',
    },
    SCRAMBLE: {
        icon: Shuffle,
        label: 'Scrambled!',
        color: 'text-orange-400',
        bgClass: 'bg-orange-500/20 border-orange-500/40',
    },
    TIME_STEAL: {
        icon: Clock,
        label: 'Time Stolen!',
        color: 'text-red-400',
        bgClass: 'bg-red-500/20 border-red-500/40',
    },
    FOG_OF_WAR: {
        icon: Cloud,
        label: 'Fog of War!',
        color: 'text-gray-400',
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
                const Icon = config.icon;
                const secondsLeft = Math.max(
                    0,
                    Math.ceil((effect.expiresAt - Date.now()) / 1000),
                );

                return (
                    <div
                        key={effect.skillType}
                        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
                    >
                        {/* Tinted overlay */}
                        {effect.skillType === 'FREEZE' && (
                            <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-[1px]" />
                        )}
                        {effect.skillType === 'BLIND' && (
                            <div className="absolute inset-0 bg-black/80" />
                        )}
                        {effect.skillType === 'FOG_OF_WAR' && (
                            <div className="absolute inset-0 backdrop-blur-md bg-black/20" />
                        )}

                        {/* Center badge */}
                        <div
                            className={`relative flex flex-col items-center gap-2 rounded-xl border px-6 py-4 shadow-lg ${config.bgClass}`}
                        >
                            <Icon className={`h-8 w-8 ${config.color} animate-pulse`} />
                            <span className={`text-lg font-bold ${config.color}`}>
                                {config.label}
                            </span>
                            {secondsLeft > 0 && (
                                <span className="font-mono text-sm text-muted-foreground">
                                    {secondsLeft}s
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </>
    );
}
