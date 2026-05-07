import type { Difficulty } from './common';

export type BattleMode = 'ONE_V_ONE' | 'BATTLE_ROYALE' | 'CLAN_VS_CLAN' | 'GROUP';
export type BattleStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
export type MatchmakingStatus = 'QUEUED' | 'MATCHED' | 'EXPIRED';
export type SkillType = 'FREEZE' | 'SCRAMBLE' | 'BLIND' | 'TIME_STEAL' | 'FOG_OF_WAR';
export type BattleRoyaleFormat = 'SAME_PROBLEM' | 'SCORE_ATTACK';
export type ClanWarsFormat = 'SAME_PROBLEM' | 'SCORE_ATTACK';
export type BattleRoundStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type BattleRoundEndReason = 'EARLY_ALL_PASSED' | 'TIMER' | 'NO_PLAYERS';

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

export interface BattleParticipant {
    id: string;
    userId: string;
    /** Flattened in some client paths; for API loads see `user`. */
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
    /** Present on REST responses (includes MMR for rank display). */
    user?: {
        id: string;
        username: string;
        mmr: number;
        avatarUrl?: string;
    };
}

export interface ProblemPoolItem {
    id: string;
    problemId: string;
    title: string;
    difficulty: Difficulty;
    pointValue: number;
    problem?: ProblemResponse;
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
    battleRoyaleFormat?: BattleRoyaleFormat;
    maxPlayers?: number;
    currentRound?: number;
    problemPool?: ProblemPoolItem[] | { items: ProblemPoolItem[] };
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
    /**
     * Set when this problem was promoted from a community submission. Used
     * by the problem panel to credit the contributor inline.
     */
    contributedBy?: {
        id: string;
        username: string;
        avatarUrl: string | null;
    } | null;
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

export interface BattleRoundSubmission {
    id?: string;
    roundId?: string;
    battleId?: string;
    userId: string;
    problemId?: string | null;
    code?: string | null;
    language?: string | null;
    testsPassed: number;
    totalTests: number;
    pointsEarned?: number;
    allPassed?: boolean;
    submittedAt?: string | null;
}

export interface BattleRoundResponse {
    id: string;
    battleId: string;
    roundNumber: number;
    status: BattleRoundStatus;
    timeLimitSeconds: number;
    eliminateCount: number;
    problemId?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    endedReason?: BattleRoundEndReason | null;
    submissions?: BattleRoundSubmission[];
}

export interface BattleRoyaleStandingsEntry {
    userId: string;
    username?: string;
    avatarUrl?: string | null;
    mmr?: number;
    isEliminated: boolean;
    placement?: number | null;
    eliminatedInRound?: number | null;
    cumulativePoints: number;
    roundPoints: number;
    testsPassed: number;
    totalTests: number;
    lastSubmittedAt?: string | null;
}

export interface BattleRoyaleStandingsResponse {
    battleId: string;
    currentRound: number;
    standings: BattleRoyaleStandingsEntry[];
}

export interface BattleRoyaleRoundStartPayload {
    battleId: string;
    roundNumber: number;
    totalRounds: number;
    problemId: string | null;
    timeLimitSeconds: number;
    eliminateCount: number;
    remainingUserIds: string[];
    startedAt: string;
}

export interface BattleRoyaleRoundEndPayload {
    battleId: string;
    roundNumber: number;
    endedReason: BattleRoundEndReason;
    eliminatedUserIds: string[];
    standings: BattleRoyaleStandingsEntry[];
}

export interface BattleRoyaleEliminationPayload {
    battleId: string;
    userId: string;
    roundNumber: number;
    placement: number;
}

export interface BattleRoyaleStandingsPayload {
    battleId: string;
    roundNumber: number;
    standings: BattleRoyaleStandingsEntry[];
}
