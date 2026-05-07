import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const VICTORY_PALETTE = ['#fbbf24', '#f59e0b', '#3b82f6', '#22c55e'];

const burstFromCorners = () => {
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
};

export function VictoryConfetti() {
    useEffect(() => {
        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return;
        }

        burstFromCorners();
        let count = 1;
        const id = window.setInterval(() => {
            burstFromCorners();
            count += 1;
            if (count >= 4) {
                window.clearInterval(id);
            }
        }, 700);

        return () => window.clearInterval(id);
    }, []);

    return null;
}
