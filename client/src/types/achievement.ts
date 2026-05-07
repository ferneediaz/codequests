export type AchievementCategory =
    | 'wins'
    | 'streak'
    | 'speed'
    | 'quality'
    | 'language'
    | 'mode'
    | 'mmr'
    | 'special'
    | 'contribution'
    | 'season';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    tier: AchievementTier;
    sortOrder: number;
    unlocked: boolean;
    unlockedAt: string | null;
}
