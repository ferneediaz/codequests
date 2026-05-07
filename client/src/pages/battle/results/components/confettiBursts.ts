import confetti from 'canvas-confetti';

const VICTORY_PALETTE = ['#fbbf24', '#f59e0b', '#3b82f6', '#22c55e'];

/**
 * Two short confetti bursts from the upper corners of the viewport. The
 * Results page victory animation fires four of these on a 700ms cadence;
 * the achievement-unlock overlay fires it once when the queue opens.
 */
export function burstFromCorners(): void {
    confetti({
        particleCount: 45,
        spread: 42,
        startVelocity: 32,
        scalar: 0.9,
        gravity: 1,
        ticks: 200,
        colors: VICTORY_PALETTE,
        origin: { x: 0.15, y: 0.25 },
        angle: 55,
    });
    confetti({
        particleCount: 45,
        spread: 42,
        startVelocity: 32,
        scalar: 0.9,
        gravity: 1,
        ticks: 200,
        colors: VICTORY_PALETTE,
        origin: { x: 0.85, y: 0.25 },
        angle: 125,
    });
}

/** True when the user has requested reduced motion. */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}
