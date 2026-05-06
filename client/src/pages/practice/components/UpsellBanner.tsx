import { Sparkles } from 'lucide-react';

export function UpsellBanner() {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
            <div className="flex-1">
                <p className="font-semibold text-foreground">
                    Practice is free - stats tracking is a Pro perk.
                </p>
                <p className="mt-1 text-muted-foreground">
                    You can run and submit any problem unlimited times. Upgrade to Pro
                    (or start a free trial) to save attempt history, get a solve-rate
                    breakdown, and see which topics you crush.
                </p>
            </div>
        </div>
    );
}
