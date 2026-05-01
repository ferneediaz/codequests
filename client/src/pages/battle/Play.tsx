import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { AnimateIn } from '@/components/layout/AnimateIn';
import { useAppSelector } from '@/store/hooks';
import { getRankTier } from '@/utils/rank';
import { usePlayConfig } from './play/usePlayConfig';
import { ModeSelector } from './play/components/ModeSelector';
import { RulesPanel } from './play/components/RulesPanel';
import { SkillsPicker } from './play/components/SkillsPicker';
import { BattleRoyalePanel } from './play/components/BattleRoyalePanel';
import { ClanWarPanel } from './play/components/ClanWarPanel';
import { InvitePanel } from './play/components/InvitePanel';

export default function Play() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    const mmr = user?.mmr ?? 1000;
    const tier = useMemo(() => getRankTier(mmr), [mmr]);
    const cfg = usePlayConfig(user?.id);

    return (
        <div className="relative min-h-[calc(100vh-4rem)]">
            <AmbientBackground variant="default" />

            <div className="relative mx-auto max-w-7xl px-4 py-8">
                {/* Top bar */}
                <div className="mb-6 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
                        style={{
                            color: tier.color,
                            borderColor: `${tier.color}40`,
                            background: `${tier.color}15`,
                        }}
                    >
                        {tier.icon} {tier.name}
                        <span className="text-muted-foreground font-mono">({mmr})</span>
                    </span>
                </div>

                {/* Hero */}
                <AnimateIn direction="up">
                    <div className="mb-8">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            New Battle
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                            Configure your{' '}
                            <span className="bg-gradient-to-r from-primary via-blue-400 to-violet-400 bg-clip-text text-transparent">
                                arena
                            </span>
                        </h1>
                        <p className="mt-2 max-w-xl text-muted-foreground">
                            Pick a mode, tune the rules, enable skills — then queue or
                            invite a friend.
                        </p>
                    </div>
                </AnimateIn>

                <div className="grid gap-6 lg:grid-cols-12">
                    {/* LEFT: CONFIG */}
                    <div className="space-y-6 lg:col-span-8">
                        <ModeSelector mode={cfg.mode} onChange={cfg.setMode} />

                        {cfg.mode !== 'BATTLE_ROYALE' && cfg.mode !== 'GROUP' && (
                            <RulesPanel
                                difficulty={cfg.difficulty}
                                onChangeDifficulty={cfg.setDifficulty}
                                timeLimitMinutes={cfg.timeLimitMinutes}
                                onChangeTimeLimit={cfg.setTimeLimitMinutes}
                                topic={cfg.topic}
                                onChangeTopic={cfg.setTopic}
                            />
                        )}

                        {cfg.mode === 'BATTLE_ROYALE' && <BattleRoyalePanel cfg={cfg} />}

                        {cfg.mode === 'GROUP' && <ClanWarPanel cfg={cfg} />}

                        <SkillsPicker
                            enabledSkills={cfg.enabledSkills}
                            onToggleSkill={cfg.toggleSkill}
                            onToggleAll={cfg.toggleAllSkills}
                        />
                    </div>

                    {/* RIGHT: SUMMARY + ACTIONS */}
                    <div className="lg:col-span-4">
                        <div className="lg:sticky lg:top-20 space-y-4">
                            <InvitePanel cfg={cfg} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
