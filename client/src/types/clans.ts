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
    mmr: number;
    members: ClanMember[];
    tier?: ClanTier;
    createdAt: string;
}

export interface CreateClanPayload {
    name: string;
    tag: string;
}

export interface UpdateClanPayload {
    name?: string;
    tag?: string;
}

export interface ListClansParams {
    limit?: number;
    offset?: number;
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
