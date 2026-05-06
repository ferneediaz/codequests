import type { BattleMode, BattleParticipant, BattleStatus } from './battle';
import type { ClanRef } from './clan';

export interface RankTier {
    name: string;
    icon: string;
    color: string;
    minMmr: number;
    maxMmr: number | null;
}

export type UserSegment = 'STUDENT' | 'PROFESSIONAL' | 'HOBBYIST' | 'PREFER_NOT_TO_SAY';
export type CodingExperience = 'NEVER' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type PrimaryGoal =
    | 'INTERVIEWS'
    | 'FUN'
    | 'CLASSROOM'
    | 'COMPETE'
    | 'SKILL_UP'
    | 'PREFER_NOT_TO_SAY';
export type HowHeard = 'FRIEND' | 'SOCIAL' | 'SEARCH' | 'SCHOOL' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type AvatarSource = 'OAUTH' | 'URL' | 'DEFAULT';
export type SubscriptionTier = 'FREE' | 'PRO';

/**
 * Mirrors the server `MeResponseDto` returned by `GET /auth/me` and
 * `POST /auth/onboarding`. Includes the `needsOnboarding` gate flag that
 * is only present on these endpoints (not on `POST /auth/sync`).
 */
export interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    needsOnboarding: boolean;
    onboardingCompletedAt: string | null;
    userSegment: UserSegment | null;
    codingExperience: CodingExperience | null;
    primaryGoal: PrimaryGoal | null;
    howHeard: HowHeard | null;
    avatarSource: AvatarSource | null;
    mmr: number;
    wins: number;
    losses: number;
    subscriptionTier: SubscriptionTier;
    stripeCustomerId: string | null;
    gamesPlayedToday: number;
    lastGameResetAt: string;
    trialEndsAt: string | null;
    hasUsedTrial: boolean;
    clanId: string | null;
    clan: ClanRef | null;
    tier?: RankTier;
    createdAt: string;
    updatedAt: string;
}

/** Body for `POST /auth/onboarding`. Mirrors server `CompleteOnboardingDto`. */
export interface CompleteOnboardingPayload {
    username: string;
    userSegment: UserSegment;
    avatarUrl?: string;
    codingExperience?: CodingExperience;
    primaryGoal?: PrimaryGoal;
    howHeard?: HowHeard;
    avatarSource?: AvatarSource;
}

export interface UserStats {
    id: string;
    username: string;
    mmr: number;
    wins: number;
    losses: number;
    tier?: RankTier;
}

export interface MatchHistoryEntry {
    id: string;
    mode: BattleMode;
    status: BattleStatus;
    winnerId?: string;
    /** Team games (e.g. GROUP) - compare with `BattleParticipant.teamId` */
    winningTeam?: string;
    startedAt?: string;
    endedAt?: string;
    createdAt: string;
    participants: BattleParticipant[];
    timeLimitMinutes: number;
}
