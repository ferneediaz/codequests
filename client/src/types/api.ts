export type BattleMode = 'ONE_V_ONE' | 'BATTLE_ROYALE' | 'CLAN_VS_CLAN' | 'GROUP';
export type BattleStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type MatchmakingStatus = 'QUEUED' | 'MATCHED' | 'EXPIRED';
export type SkillType = 'FREEZE' | 'SCRAMBLE' | 'BLIND' | 'TIME_STEAL' | 'FOG_OF_WAR';
export type BattleRoyaleFormat = 'SAME_PROBLEM' | 'SCORE_ATTACK';
export type ClanWarsFormat = 'SAME_PROBLEM' | 'SCORE_ATTACK';

/**
 * Configuration for a single Battle Royale round.
 * Mirrors server `RoundConfigDto`:
 *  - timeLimitSeconds: integer 10..7200
 *  - eliminateCount: integer >= 0 (sum across rounds must equal maxPlayers - 1,
 *    and the last round must equal exactly 1)
 */
export interface RoundConfig {
    timeLimitSeconds: number;
    eliminateCount: number;
}

/**
 * Server-provided Battle Royale preset (from `GET /battles/royale/presets`).
 * Clients may use as-is or mutate before POSTing.
 */
export interface RoyalePreset {
    id: string;
    name: string;
    description: string;
    battleRoyaleFormat: BattleRoyaleFormat;
    maxPlayers: number;
    rounds: RoundConfig[];
}

export interface ClanWarsPresetRound {
    timeLimitSeconds: number;
}

export interface ClanWarsPreset {
    id: string;
    name: string;
    description: string;
    clanWarsFormat: ClanWarsFormat;
    teamSize: number;
    rounds: ClanWarsPresetRound[];
}

export interface MatchConfig {
    mode: BattleMode;
    preferredDifficulty?: Difficulty;
    preferredTopic?: string;
    timeLimitMinutes: number;
    enabledSkills: SkillType[];
}

export interface CreateBattleRequest {
    mode?: BattleMode;
    teamSize?: number;
    timeLimitMinutes?: number;
    enabledSkills?: SkillType[];
    withInviteCode?: boolean;
    preferredTopic?: string;
    preferredDifficulty?: Difficulty;
    /** Battle Royale only. */
    battleRoyaleFormat?: BattleRoyaleFormat;
    /** Battle Royale only. Integer in [3, 50]. */
    maxPlayers?: number;
    /** Battle Royale only. Must contain at least 2 rounds. */
    rounds?: RoundConfig[];
    /** Battle Royale SCORE_ATTACK only: optional explicit pool of problem IDs. */
    problemIds?: string[];
}

export interface ClanTeamMeta {
    name?: string;
    tag?: string;
    clanId?: string;
}

export interface CreateClanWarsRequest {
    clanWarsFormat: ClanWarsFormat;
    teamSize: number;
    rounds: ClanWarsPresetRound[];
    enabledSkills?: SkillType[];
    preferredTopic?: string;
    preferredDifficulty?: Difficulty;
    problemIds?: string[];
    teamOne?: ClanTeamMeta;
    teamTwo?: ClanTeamMeta;
    withInviteCode?: boolean;
}

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

export interface ClanRef {
    id: string;
    name: string;
    tag: string;
}

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

export interface BattleParticipant {
    id: string;
    userId: string;
    username: string;
    teamId?: string;
    code?: string;
    language?: string;
    testsPassed: number;
    totalTests: number;
    pointsEarned: number;
    isReady: boolean;
    submittedAt?: string;
    mmrChange?: number;
}

export interface BattleResponse {
    id: string;
    mode: BattleMode;
    problemId?: string;
    teamSize?: number;
    timeLimitMinutes: number;
    autoBalance: boolean;
    winnerId?: string;
    winningTeam?: string;
    status: BattleStatus;
    startedAt?: string;
    endedAt?: string;
    createdAt: string;
    participants: BattleParticipant[];
    enabledSkills?: SkillType[];
    inviteCode?: string;
    inviteExpiresAt?: string;
}

export interface TestCaseResult {
    testCaseId: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput?: string;
    /** User's `console.log` / `print` output for this test case, routed
     * to the Console tab. Empty for v1 problems. */
    stdout?: string | null;
    /** Captured stderr (runtime + compile). Shown in red in the console. */
    stderr?: string | null;
    error?: string;
    executionTime?: number;
}

export interface SubmissionResult {
    passed: number;
    total: number;
    allPassed: boolean;
    results: TestCaseResult[];
}

export interface ProblemResponse {
    id: string;
    title: string;
    description: string;
    difficulty: Difficulty;
    /**
     * JSON string keyed by language: `{ lang: { prefix, body, suffix } }` as
     * written by the v2 problem importer. The editor only shows `body`;
     * the server stitches prefix + body + suffix before execution.
     */
    starterCode: string;
    testCases?: {
        id: string;
        input: string;
        expectedOutput: string;
        isHidden: boolean;
    }[];
    createdAt: string;
    updatedAt: string;
}

export interface LanguageStarter {
    prefix: string;
    body: string;
    suffix: string;
}

export type StarterCodeMap = Record<string, LanguageStarter>;

export interface QueueStatusResponse {
    inQueue: boolean;
    id?: string;
    mode?: BattleMode;
    preferredDifficulty?: Difficulty | null;
    status?: MatchmakingStatus;
    queuedAt?: string;
    battleId?: string;
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
    startedAt?: string;
    endedAt?: string;
    createdAt: string;
    participants: BattleParticipant[];
    timeLimitMinutes: number;
}

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
