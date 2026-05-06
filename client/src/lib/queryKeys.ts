export const queryKeys = {
    userStats: (userId: string) => ['userStats', userId] as const,
    matchHistory: (userId: string, limit = 20) =>
        ['matchHistory', userId, limit] as const,
    newsFeed: (userId: string) => ['newsFeed', userId] as const,
    githubActivity: (userId: string, year: string) =>
        ['githubActivity', userId, year] as const,
    battle: (battleId: string) => ['battle', battleId] as const,
    problem: (problemId: string) => ['problem', problemId] as const,
    battlePresets: {
        royale: () => ['battles', 'royale', 'presets'] as const,
        clanWars: () => ['battles', 'clan-wars', 'presets'] as const,
    },
    practice: {
        problems: () => ['practice', 'problems'] as const,
        stats: () => ['practice', 'stats'] as const,
        problem: (id: string) => ['practice', 'problem', id] as const,
    },
};
