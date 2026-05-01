import {
    Crown,
    Handshake,
    Hourglass,
    Repeat,
    Swords,
    Trophy,
    Users,
    XCircle,
} from 'lucide-react';
import type {
    BattleMode,
    NewsItem,
    NewsItemSeverity,
    NewsItemType,
} from '@/types/api';

export const MODE_META: Record<BattleMode, { label: string; icon: typeof Swords }> = {
    ONE_V_ONE: { label: '1v1', icon: Swords },
    BATTLE_ROYALE: { label: 'Royale', icon: Crown },
    GROUP: { label: 'Group', icon: Users },
    CLAN_VS_CLAN: { label: 'Clan', icon: Users },
};

export const NEWS_TYPE_ICON: Record<NewsItemType, typeof Swords> = {
    CLAN_CHALLENGE_SENT: Swords,
    CLAN_CHALLENGE_ACCEPTED: Handshake,
    CLAN_CHALLENGE_DECLINED: XCircle,
    CLAN_CHALLENGE_COUNTERED: Repeat,
    CLAN_CHALLENGE_EXPIRED: Hourglass,
    FRIEND_BATTLE_RESULT: Trophy,
};

export const SEVERITY_STYLES: Record<
    NewsItemSeverity,
    { icon: string; iconBg: string; border: string }
> = {
    neutral: {
        icon: 'text-primary',
        iconBg: 'bg-primary/10',
        border: 'border-border/60',
    },
    positive: {
        icon: 'text-green-500',
        iconBg: 'bg-green-500/10',
        border: 'border-green-500/30',
    },
    warning: {
        icon: 'text-amber-400',
        iconBg: 'bg-amber-400/10',
        border: 'border-amber-400/30',
    },
    negative: {
        icon: 'text-red-500',
        iconBg: 'bg-red-500/10',
        border: 'border-red-500/30',
    },
};

export const HARD_CODED_NEWS_PREVIEW: NewsItem[] = [
    {
        id: 'preview-clan-sent-harvard-mit',
        type: 'CLAN_CHALLENGE_SENT',
        severity: 'neutral',
        category: 'clan',
        isShame: false,
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        text: 'Harvard Coders challenged MIT Hackers to a clan war.',
        challengerClan: { id: 'clan-harvard-coders', name: 'Harvard Coders', tag: 'HVD' },
        challengedClan: { id: 'clan-mit-hackers', name: 'MIT Hackers', tag: 'MIT' },
    },
    {
        id: 'preview-clan-declined-mit-harvard',
        type: 'CLAN_CHALLENGE_DECLINED',
        severity: 'negative',
        category: 'clan',
        isShame: true,
        timestamp: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
        text: 'MIT Hackers declined Harvard Coders challenge.',
        challengerClan: { id: 'clan-harvard-coders', name: 'Harvard Coders', tag: 'HVD' },
        challengedClan: { id: 'clan-mit-hackers', name: 'MIT Hackers', tag: 'MIT' },
    },
    {
        id: 'preview-clan-expired-mit-harvard',
        type: 'CLAN_CHALLENGE_EXPIRED',
        severity: 'warning',
        category: 'clan',
        isShame: true,
        timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
        text: 'MIT Hackers did not respond to Harvard Coders challenge in time.',
        challengerClan: { id: 'clan-harvard-coders', name: 'Harvard Coders', tag: 'HVD' },
        challengedClan: { id: 'clan-mit-hackers', name: 'MIT Hackers', tag: 'MIT' },
    },
    {
        id: 'preview-clan-win-mit-harvard',
        type: 'CLAN_CHALLENGE_ACCEPTED',
        severity: 'positive',
        category: 'clan',
        isShame: false,
        timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        text: 'MIT Hackers won a clan war against Harvard Coders.',
        challengerClan: { id: 'clan-harvard-coders', name: 'Harvard Coders', tag: 'HVD' },
        challengedClan: { id: 'clan-mit-hackers', name: 'MIT Hackers', tag: 'MIT' },
    },
    {
        id: 'preview-friends-win-lina-kai',
        type: 'FRIEND_BATTLE_RESULT',
        severity: 'positive',
        category: 'friends',
        isShame: false,
        timestamp: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        text: 'Lina beat Kai in a friend battle (2-1 tests solved).',
        winner: { id: 'user-lina', username: 'Lina' },
        loser: { id: 'user-kai', username: 'Kai' },
        participants: [
            { id: 'user-lina', username: 'Lina' },
            { id: 'user-kai', username: 'Kai' },
        ],
        battleMode: 'ONE_V_ONE',
        battleId: 'preview-battle-lina-kai',
    },
    {
        id: 'preview-friends-win-noah-zara',
        type: 'FRIEND_BATTLE_RESULT',
        severity: 'positive',
        category: 'friends',
        isShame: false,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        text: 'Noah defeated Zara in a friend rematch.',
        winner: { id: 'user-noah', username: 'Noah' },
        loser: { id: 'user-zara', username: 'Zara' },
        participants: [
            { id: 'user-noah', username: 'Noah' },
            { id: 'user-zara', username: 'Zara' },
        ],
        battleMode: 'ONE_V_ONE',
        battleId: 'preview-battle-noah-zara',
    },
];
