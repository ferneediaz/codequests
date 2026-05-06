import type { BattleMode, ClanWarsFormat, SkillType } from './battle';

export interface ClanMember {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    wins?: number;
    losses?: number;
    role?: 'OWNER' | 'MEMBER';
}

export interface ClanTier {
    name: string;
    icon: string;
    color: string;
    minMmr: number;
    maxMmr: number | null;
}

export interface Clan {
    id: string;
    name: string;
    tag: string;
    ownerId: string;
    bannerUrl?: string | null;
    logoUrl?: string | null;
    inviteOnly?: boolean;
    mmr: number;
    members: ClanMember[];
    tier?: ClanTier;
    createdAt: string;
}

export interface CreateClanPayload {
    name: string;
    tag: string;
    bannerUrl?: string;
    logoUrl?: string;
    inviteOnly?: boolean;
}

export interface UpdateClanPayload {
    name?: string;
    tag?: string;
    bannerUrl?: string;
    logoUrl?: string;
    inviteOnly?: boolean;
}

export interface ListClansParams {
    limit?: number;
    offset?: number;
    q?: string;
}

export interface ClanBattleHistory {
    clan: {
        id: string;
        name: string;
        tag: string;
        wins: number;
        losses: number;
        mmr: number;
    };
    data: {
        id: string;
        mode: BattleMode | 'CLAN_WARS';
        winningTeam?: string | null;
        teamSize?: number | null;
        endedAt?: string | null;
        createdAt: string;
        clanResult: 'win' | 'loss' | 'draw';
        participants: {
            userId: string;
            username: string;
            avatarUrl?: string | null;
            teamId?: string | null;
            pointsEarned: number;
            clan?: { id: string; name: string; tag: string } | null;
        }[];
    }[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export type ClanJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ClanJoinRequest {
    id: string;
    clanId: string;
    userId: string;
    status: ClanJoinRequestStatus;
    message?: string | null;
    createdAt: string;
    updatedAt: string;
    clan: { id: string; name: string; tag: string; ownerId: string };
    user: {
        id: string;
        username: string;
        avatarUrl?: string | null;
        mmr: number;
    };
}

export type ClanChallengeStatus =
    | 'PENDING'
    | 'ACCEPTED'
    | 'DECLINED'
    | 'COUNTERED'
    | 'EXPIRED'
    | 'CANCELLED';

export interface ChallengeClan {
    id: string;
    name: string;
    tag: string;
    mmr: number;
}

export interface ClanChallenge {
    id: string;
    status: ClanChallengeStatus;
    challengerClan: ChallengeClan;
    challengedClan: ChallengeClan;
    message?: string;
    teamSize: number;
    timeLimitMinutes: number;
    enabledSkills: SkillType[];
    preferredTopic?: string;
    counterTeamSize?: number;
    counterTimeLimitMinutes?: number;
    counterEnabledSkills?: SkillType[];
    counterPreferredTopic?: string;
    counterMessage?: string;
    expiresAt: string;
    respondedAt?: string;
    createdAt: string;
    battleId?: string | null;
}

export interface SendClanChallengePayload {
    targetClanId: string;
    message?: string;
    mode?: BattleMode | 'CLAN_WARS';
    teamSize?: number;
    timeLimitMinutes?: number;
    enabledSkills?: SkillType[];
    preferredTopic?: string;
    clanWarsFormat?: ClanWarsFormat;
    rounds?: { timeLimitSeconds: number }[];
}

export interface CounterClanChallengePayload {
    counterMessage?: string;
    mode?: BattleMode | 'CLAN_WARS';
    teamSize?: number;
    timeLimitMinutes?: number;
    enabledSkills?: SkillType[];
    preferredTopic?: string;
    clanWarsFormat?: ClanWarsFormat;
    rounds?: { timeLimitSeconds: number }[];
}
