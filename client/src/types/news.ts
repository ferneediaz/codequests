export type NewsItemType =
    | 'CLAN_CHALLENGE_SENT'
    | 'CLAN_CHALLENGE_ACCEPTED'
    | 'CLAN_CHALLENGE_DECLINED'
    | 'CLAN_CHALLENGE_COUNTERED'
    | 'CLAN_CHALLENGE_EXPIRED'
    | 'FRIEND_BATTLE_RESULT';

export type NewsItemSeverity = 'neutral' | 'positive' | 'warning' | 'negative';

export type NewsItemCategory = 'clan' | 'friends';

export type NewsFilter = 'all' | 'clan' | 'friends' | 'shame';

export interface NewsClanRef {
    id: string;
    name: string;
    tag: string;
}

export interface NewsUserRef {
    id: string;
    username: string;
    avatarUrl?: string | null;
}

export interface NewsItem {
    id: string;
    type: NewsItemType;
    severity: NewsItemSeverity;
    category: NewsItemCategory;
    isShame: boolean;
    timestamp: string;
    text: string;
    challengerClan?: NewsClanRef;
    challengedClan?: NewsClanRef;
    battleId?: string;
    battleMode?: string;
    participants?: NewsUserRef[];
    winner?: NewsUserRef | null;
    loser?: NewsUserRef | null;
    isDraw?: boolean;
}

export interface NewsResponse {
    items: NewsItem[];
    nextCursor: string | null;
}
