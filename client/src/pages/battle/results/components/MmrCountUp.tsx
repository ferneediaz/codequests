import { useEffect, useState } from 'react';

interface MmrCountUpProps {
    from: number;
    to: number;
    durationMs?: number;
    className?: string;
    formatSign?: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const detectReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MmrCountUp({
    from,
    to,
    durationMs = 1200,
    className,
    formatSign = false,
}: MmrCountUpProps) {
    const [prefersReducedMotion] = useState(detectReducedMotion);
    const [animatedValue, setAnimatedValue] = useState(from);

    useEffect(() => {
        if (prefersReducedMotion) return;

        let raf = 0;
        const start = performance.now();
        const delta = to - from;

        const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(1, elapsed / durationMs);
            const eased = easeOutCubic(t);
            setAnimatedValue(from + delta * eased);
            if (t < 1) {
                raf = requestAnimationFrame(tick);
            }
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [from, to, durationMs, prefersReducedMotion]);

    const rounded = prefersReducedMotion ? to : Math.round(animatedValue);
    const display = formatSign && rounded > 0 ? `+${rounded}` : `${rounded}`;

    return <span className={className ?? 'font-mono'}>{display}</span>;
}
