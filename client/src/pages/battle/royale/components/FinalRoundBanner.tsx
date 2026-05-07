import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';

/**
 * Plays once on mount, then auto-hides after a short splash. Parents control
 * "show once per round" by mounting/unmounting via `key` (typically the round
 * number) and conditioning on `isFinalRound`.
 */
const SPLASH_DURATION_MS = 3500;

export function FinalRoundBanner() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timeout = setTimeout(() => setVisible(false), SPLASH_DURATION_MS);
        return () => clearTimeout(timeout);
    }, []);

    if (!visible) return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-yellow-500/40 bg-background/90 px-6 py-3 text-yellow-500 shadow-lg backdrop-blur duration-300 animate-in fade-in zoom-in-95">
                <Crown className="h-5 w-5" />
                <span className="text-lg font-black tracking-widest">FINAL ROUND</span>
            </div>
        </div>
    );
}
