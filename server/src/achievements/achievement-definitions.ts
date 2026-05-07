import { computeStreak, StreakOutcome } from './streak.util';

export interface AchievementBattleContext {
    id: string;
    mode: string; // BattleMode string ("ONE_V_ONE" | "BATTLE_ROYALE" | "CLAN_VS_CLAN" | "GROUP" | "CLAN_WARS")
    isWinner: boolean;
    /** Snapshot of the user's MMR going INTO the battle (used for Underdog). */
    preBattleMmr: number;
    participant: {
        language: string | null;
        testsPassed: number;
        totalTests: number;
        submittedAt: Date | null;
    };
    /** 1v1 only: the other participant's snapshot. */
    opponent: {
        preBattleMmr: number;
        testsPassed: number;
        totalTests: number;
    } | null;
    startedAt: Date | null;
    endedAt: Date;
}

/**
 * Helpers passed into checkers so we don't bloat the context with full Prisma
 * queries up front. Each helper is called only by the checkers that need it.
 * The service is responsible for caching repeat calls (see `runChecks`).
 */
export interface AchievementHelpers {
    countWinsByLanguage(language: string): Promise<number>;
    countDistinctWinningLanguages(): Promise<number>;
    countWinsAt100PercentTests(): Promise<number>;
    countClanWarsWins(): Promise<number>;
    /** Most-recent-first list of W/L/D outcomes for the user. */
    recentOutcomes(): Promise<StreakOutcome[]>;
}

export interface AchievementContext {
    userId: string;
    /** User stats AFTER the triggering event has applied. */
    user: { wins: number; losses: number; mmr: number };
    /** Set when the trigger is a battle completion. */
    battle?: AchievementBattleContext;
    /** Set when the trigger is a problem-submission approval. */
    approvedProblemSubmissionId?: string;
    /** Set when the trigger is a season finishing with this user in the top 100. */
    seasonTopPlacement?: { seasonId: string; placement: number };
    helpers: AchievementHelpers;
}

export type AchievementChecker = (
    ctx: AchievementContext,
) => boolean | Promise<boolean>;

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

export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    tier: AchievementTier;
    sortOrder: number;
    check: AchievementChecker;
}

const battleWon = (ctx: AchievementContext) => !!ctx.battle?.isWinner;

const elapsedSeconds = (b: AchievementBattleContext): number | null => {
    if (!b.startedAt || !b.participant.submittedAt) return null;
    return (b.participant.submittedAt.getTime() - b.startedAt.getTime()) / 1000;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
    // Wins
    {
        id: 'first_blood',
        title: 'First Blood',
        description: 'Win your first battle.',
        icon: 'Swords',
        category: 'wins',
        tier: 'bronze',
        sortOrder: 10,
        check: (ctx) => battleWon(ctx) && ctx.user.wins === 1,
    },
    {
        id: 'centurion',
        title: 'Centurion',
        description: 'Win 100 battles.',
        icon: 'Crown',
        category: 'wins',
        tier: 'gold',
        sortOrder: 20,
        check: (ctx) => battleWon(ctx) && ctx.user.wins >= 100,
    },
    {
        id: 'marathon',
        title: 'Marathon',
        description: 'Play 100 battles total.',
        icon: 'Hourglass',
        category: 'wins',
        tier: 'silver',
        sortOrder: 30,
        check: (ctx) =>
            !!ctx.battle && ctx.user.wins + ctx.user.losses >= 100,
    },

    // Streaks
    {
        id: 'on_fire',
        title: 'On Fire',
        description: 'Win 5 battles in a row.',
        icon: 'Flame',
        category: 'streak',
        tier: 'bronze',
        sortOrder: 110,
        check: async (ctx) => {
            if (!battleWon(ctx)) return false;
            const s = computeStreak(await ctx.helpers.recentOutcomes());
            return s.type === 'W' && s.count >= 5;
        },
    },
    {
        id: 'unstoppable',
        title: 'Unstoppable',
        description: 'Win 10 battles in a row.',
        icon: 'Flame',
        category: 'streak',
        tier: 'silver',
        sortOrder: 120,
        check: async (ctx) => {
            if (!battleWon(ctx)) return false;
            const s = computeStreak(await ctx.helpers.recentOutcomes());
            return s.type === 'W' && s.count >= 10;
        },
    },
    {
        id: 'legendary',
        title: 'Legendary',
        description: 'Win 25 battles in a row.',
        icon: 'Flame',
        category: 'streak',
        tier: 'gold',
        sortOrder: 130,
        check: async (ctx) => {
            if (!battleWon(ctx)) return false;
            const s = computeStreak(await ctx.helpers.recentOutcomes());
            return s.type === 'W' && s.count >= 25;
        },
    },

    // Speed
    {
        id: 'speed_demon',
        title: 'Speed Demon',
        description: 'Win in under 2 minutes.',
        icon: 'Zap',
        category: 'speed',
        tier: 'bronze',
        sortOrder: 210,
        check: (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            const elapsed = elapsedSeconds(ctx.battle);
            return elapsed != null && elapsed < 120;
        },
    },
    {
        id: 'flash',
        title: 'Flash',
        description: 'Win in under 60 seconds.',
        icon: 'Bolt',
        category: 'speed',
        tier: 'silver',
        sortOrder: 220,
        check: (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            const elapsed = elapsedSeconds(ctx.battle);
            return elapsed != null && elapsed < 60;
        },
    },

    // Quality
    {
        id: 'perfectionist',
        title: 'Perfectionist',
        description: 'Win with 100% of test cases passing.',
        icon: 'Target',
        category: 'quality',
        tier: 'bronze',
        sortOrder: 310,
        check: (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            const p = ctx.battle.participant;
            return p.totalTests > 0 && p.testsPassed === p.totalTests;
        },
    },
    {
        id: 'flawless',
        title: 'Flawless',
        description: 'Win 10 battles at 100% tests passed.',
        icon: 'Target',
        category: 'quality',
        tier: 'silver',
        sortOrder: 320,
        check: async (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            const p = ctx.battle.participant;
            if (p.totalTests === 0 || p.testsPassed !== p.totalTests) return false;
            return (await ctx.helpers.countWinsAt100PercentTests()) >= 10;
        },
    },

    // Language
    {
        id: 'pythonista',
        title: 'Pythonista',
        description: 'Win 10 battles using Python.',
        icon: 'Code2',
        category: 'language',
        tier: 'silver',
        sortOrder: 410,
        check: async (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            if (ctx.battle.participant.language !== 'python') return false;
            return (await ctx.helpers.countWinsByLanguage('python')) >= 10;
        },
    },
    {
        id: 'js_wizard',
        title: 'JS Wizard',
        description: 'Win 10 battles using JavaScript.',
        icon: 'Code2',
        category: 'language',
        tier: 'silver',
        sortOrder: 420,
        check: async (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            if (ctx.battle.participant.language !== 'javascript') return false;
            return (await ctx.helpers.countWinsByLanguage('javascript')) >= 10;
        },
    },
    {
        id: 'polyglot',
        title: 'Polyglot',
        description: 'Win battles using 3 different languages.',
        icon: 'Languages',
        category: 'language',
        tier: 'silver',
        sortOrder: 430,
        check: async (ctx) => {
            if (!battleWon(ctx)) return false;
            return (await ctx.helpers.countDistinctWinningLanguages()) >= 3;
        },
    },

    // Mode
    {
        id: 'royale_survivor',
        title: 'Royale Survivor',
        description: 'Win a Battle Royale.',
        icon: 'Trophy',
        category: 'mode',
        tier: 'bronze',
        sortOrder: 510,
        check: (ctx) =>
            battleWon(ctx) && ctx.battle?.mode === 'BATTLE_ROYALE',
    },
    {
        id: 'clan_champion',
        title: 'Clan Champion',
        description: 'Win 10 Clan Wars (or Clan vs Clan) battles.',
        icon: 'Shield',
        category: 'mode',
        tier: 'gold',
        sortOrder: 520,
        check: async (ctx) => {
            if (!battleWon(ctx) || !ctx.battle) return false;
            if (
                ctx.battle.mode !== 'CLAN_WARS' &&
                ctx.battle.mode !== 'CLAN_VS_CLAN'
            ) {
                return false;
            }
            return (await ctx.helpers.countClanWarsWins()) >= 10;
        },
    },

    // MMR
    {
        id: 'top_1000',
        title: 'Top 1000',
        description: 'Reach 2000 MMR.',
        icon: 'Medal',
        category: 'mmr',
        tier: 'silver',
        sortOrder: 610,
        check: (ctx) => ctx.user.mmr >= 2000,
    },
    {
        id: 'mythic',
        title: 'Mythic',
        description: 'Reach 2500 MMR.',
        icon: 'Star',
        category: 'mmr',
        tier: 'gold',
        sortOrder: 620,
        check: (ctx) => ctx.user.mmr >= 2500,
    },

    // Special
    {
        id: 'underdog',
        title: 'Underdog',
        description: 'Win a 1v1 against an opponent with higher MMR.',
        icon: 'TrendingUp',
        category: 'special',
        tier: 'bronze',
        sortOrder: 710,
        check: (ctx) => {
            if (!ctx.battle?.isWinner) return false;
            if (ctx.battle.mode !== 'ONE_V_ONE') return false;
            if (!ctx.battle.opponent) return false;
            return ctx.battle.opponent.preBattleMmr > ctx.battle.preBattleMmr;
        },
    },
    {
        id: 'no_mercy',
        title: 'No Mercy',
        description: 'Win a 1v1 with the opponent at 0 tests passed.',
        icon: 'Skull',
        category: 'special',
        tier: 'bronze',
        sortOrder: 720,
        check: (ctx) => {
            if (!ctx.battle?.isWinner) return false;
            if (ctx.battle.mode !== 'ONE_V_ONE') return false;
            if (!ctx.battle.opponent) return false;
            return ctx.battle.opponent.testsPassed === 0;
        },
    },

    // Contribution
    {
        id: 'problem_setter',
        title: 'Problem Setter',
        description: 'Have a contributed problem approved.',
        icon: 'BookOpen',
        category: 'contribution',
        tier: 'gold',
        sortOrder: 810,
        check: (ctx) => !!ctx.approvedProblemSubmissionId,
    },

    // Season
    {
        id: 'seasonal_glory',
        title: 'Seasonal Glory',
        description: 'Finish a season in the top 100 by peak MMR.',
        icon: 'Award',
        category: 'season',
        tier: 'gold',
        sortOrder: 910,
        check: (ctx) =>
            !!ctx.seasonTopPlacement && ctx.seasonTopPlacement.placement <= 100,
    },
];
