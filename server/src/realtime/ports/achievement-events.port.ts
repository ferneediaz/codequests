export interface AchievementUnlockedPayload {
    userId: string;
    achievementId: string;
    title: string;
    description: string;
    icon: string;
    tier: string;
    unlockedAt: Date | string;
}

export interface AchievementEventsPort {
    /** Emit `achievement.unlocked` to the user; silently no-ops if offline. */
    emitAchievementUnlocked(
        userId: string,
        data: AchievementUnlockedPayload,
    ): void;
}

export const ACHIEVEMENT_EVENTS_PORT = 'ACHIEVEMENT_EVENTS_PORT';
