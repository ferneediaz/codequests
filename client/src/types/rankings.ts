export type RankingsPeriod = 'daily' | 'weekly' | 'monthly' | 'alltime';

export interface RankingsTier {
    name: string;
    icon: string;
    color: string;
    minMmr: number;
    maxMmr: number | null;
}

export interface RankingsClanRef {
    tag: string;
    name: string;
}

export interface UserRankingRow {
    rank: number;
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    tier: RankingsTier;
    clan?: RankingsClanRef | null;
    mmrGained: number;
    winsInPeriod: number;
    lossesInPeriod: number;
    gamesPlayed: number;
    winsInLanguage?: number;
}

export interface ClanRankingRow {
    rank: number;
    id: string;
    name: string;
    tag: string;
    mmr: number;
    tier: RankingsTier;
    memberCount: number;
    winsInPeriod: number;
    lossesInPeriod: number;
}

export interface RankingsQuery {
    period?: RankingsPeriod;
    language?: string;
    limit?: number;
    offset?: number;
}
