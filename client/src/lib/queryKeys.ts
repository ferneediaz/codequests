export const queryKeys = {
    userStats: (userId: string) => ['userStats', userId] as const,
    matchHistory: (userId: string, limit = 20) =>
        ['matchHistory', userId, limit] as const,
    newsFeed: (userId: string) => ['newsFeed', userId] as const,
    githubActivity: (userId: string, year: string) =>
        ['githubActivity', userId, year] as const,
    battle: (battleId: string) => ['battle', battleId] as const,
    battleRounds: (battleId: string) => ['battle', battleId, 'rounds'] as const,
    battleRound: (battleId: string, roundNumber: number) =>
        ['battle', battleId, 'rounds', roundNumber] as const,
    battleStandings: (battleId: string) =>
        ['battle', battleId, 'standings'] as const,
    problem: (problemId: string) => ['problem', problemId] as const,
    battlePresets: {
        royale: () => ['battles', 'royale', 'presets'] as const,
        clanWars: () => ['battles', 'clan-wars', 'presets'] as const,
    },
    friends: {
        list: () => ['friends', 'list'] as const,
        incoming: () => ['friends', 'incoming'] as const,
    },
    chat: {
        conversations: () => ['chat', 'conversations'] as const,
        unreadCounts: () => ['chat', 'unreadCounts'] as const,
    },
    clans: {
        list: (limit: number, offset: number, q?: string) =>
            ['clans', 'list', limit, offset, q ?? ''] as const,
        detail: (id: string) => ['clans', 'detail', id] as const,
        challenges: (id: string, pending?: boolean) =>
            ['clans', 'challenges', id, pending] as const,
    },
    practice: {
        problems: () => ['practice', 'problems'] as const,
        stats: () => ['practice', 'stats'] as const,
        statsForUser: (userId: string) => ['practice', 'stats', userId] as const,
        problem: (id: string) => ['practice', 'problem', id] as const,
    },
    userByUsername: (username: string) =>
        ['user', 'by-username', username.toLowerCase()] as const,
    userContributions: (userId: string) =>
        ['user', userId, 'contributions'] as const,
    friendStatus: {
        sent: () => ['friends', 'sent'] as const,
    },
    achievements: {
        mine: () => ['achievements', 'mine'] as const,
        forUser: (userId: string) => ['achievements', userId] as const,
    },
    leaderboard: (limit: number) => ['leaderboard', limit] as const,
    rankings: {
        global: (
            period: string,
            language: string,
            limit: number,
            offset: number,
        ) => ['rankings', 'global', period, language, limit, offset] as const,
        clans: (period: string, limit: number, offset: number) =>
            ['rankings', 'clans', period, limit, offset] as const,
        friends: (
            period: string,
            language: string,
            limit: number,
            offset: number,
        ) => ['rankings', 'friends', period, language, limit, offset] as const,
    },
};
