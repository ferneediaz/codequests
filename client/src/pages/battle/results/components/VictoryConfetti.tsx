import { useEffect } from 'react';
import { burstFromCorners, prefersReducedMotion } from './confettiBursts';

export function VictoryConfetti() {
    useEffect(() => {
        if (prefersReducedMotion()) return;

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
