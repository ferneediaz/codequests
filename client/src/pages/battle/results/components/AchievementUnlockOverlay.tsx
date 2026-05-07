import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '@/services/socket';
import type { AchievementUnlockedPayload } from '@/types/socket';
import { AchievementUnlockPopup } from './AchievementUnlockPopup';
import { burstFromCorners, prefersReducedMotion } from './confettiBursts';

interface AchievementUnlockOverlayProps {
    battleId: string;
}

/**
 * Listens for `achievement.unlocked` events scoped to the active battle and
 * renders one celebratory popup at a time. The first arrival also fires a
 * shared confetti burst (so multi-unlock battles still feel like one beat
 * rather than four overlapping bursts).
 */
export function AchievementUnlockOverlay({
    battleId,
}: AchievementUnlockOverlayProps) {
    const [queue, setQueue] = useState<AchievementUnlockedPayload[]>([]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onUnlock = (data: AchievementUnlockedPayload) => {
            if (data.battleId !== battleId) return;
            setQueue((prev) => {
                if (prev.length === 0 && !prefersReducedMotion()) {
                    burstFromCorners();
                }
                if (prev.some((q) => q.achievementId === data.achievementId)) {
                    return prev;
                }
                return [...prev, data];
            });
        };

        socket.on('achievement.unlocked', onUnlock);
        return () => {
            socket.off('achievement.unlocked', onUnlock);
        };
    }, [battleId]);

    const handleDismiss = useCallback(() => {
        setQueue((prev) => prev.slice(1));
    }, []);

    if (queue.length === 0) return null;
    const head = queue[0];
    return (
        <AchievementUnlockPopup
            achievement={head}
            queueRemaining={queue.length - 1}
            onDismiss={handleDismiss}
        />
    );
}
