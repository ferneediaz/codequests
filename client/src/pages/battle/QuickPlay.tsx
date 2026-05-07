import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Settings2, Sparkles, Zap } from 'lucide-react';
import { AmbientBackground } from '@/components/layout/AmbientBackground';
import { PageHero } from '@/components/layout/PageHero';
import { Button } from '@/components/ui/button';
import { useQuickPlayPresets } from '@/hooks/useQuickPlayPresets';
import { usePaywall } from '@/hooks/usePaywall';
import { PresetSummaryCard } from './quick/components/PresetSummaryCard';
import { PresetList } from './quick/components/PresetList';

export default function QuickPlay() {
    const navigate = useNavigate();
    const { requireCanPlay } = usePaywall();
    const { presets, activeId, activePreset, setActiveId, rename, remove } =
        useQuickPlayPresets();

    if (!activePreset) {
        // Should never happen — listPresets always seeds the builtin — but guard anyway.
        return null;
    }

    const handlePlayNow = () => {
        if (!requireCanPlay()) return;
        navigate('/matchmaking', {
            state: { config: activePreset.config },
        });
    };

    const handleRemove = (id: string) => {
        const removed = presets.find((p) => p.id === id);
        remove(id);
        if (removed) toast.success(`Removed "${removed.name}"`);
    };

    const handleRename = (id: string, name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        rename(id, trimmed);
        toast.success(`Renamed to "${trimmed}"`);
    };

    const userPresetCount = presets.filter((p) => !p.builtin).length;

    return (
        <div className="relative min-h-screen pb-16">
            <AmbientBackground />
            <div className="relative z-10 mx-auto max-w-5xl space-y-8 p-6">
                <PageHero
                    icon={<Zap className="h-9 w-9 text-primary" />}
                    eyebrow="Quick Play"
                    title="One-click into a match"
                    description="Pick a saved preset and queue up. Build new presets from the full Play wizard."
                    actions={
                        <Button asChild variant="outline">
                            <Link to="/play">
                                <Settings2 className="mr-2 h-4 w-4" />
                                Build a preset
                            </Link>
                        </Button>
                    }
                />

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-4">
                        <PresetSummaryCard preset={activePreset} />
                        <Button
                            className="h-12 w-full text-base"
                            onClick={handlePlayNow}
                        >
                            <Zap className="mr-2 h-4 w-4" />
                            Play Now
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        {userPresetCount === 0 && (
                            <div className="rounded-lg border border-dashed border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2 text-foreground">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <span className="font-medium">
                                        Save your favourite settings
                                    </span>
                                </div>
                                <p className="mt-1">
                                    Configure a 1v1 in the Play wizard and hit{' '}
                                    <span className="font-medium text-foreground">
                                        Save as preset
                                    </span>{' '}
                                    to add it here.
                                </p>
                            </div>
                        )}
                    </div>
                    <div>
                        <PresetList
                            presets={presets}
                            activeId={activeId}
                            onActivate={setActiveId}
                            onRename={handleRename}
                            onDelete={handleRemove}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
