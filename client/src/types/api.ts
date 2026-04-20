export type BattleMode = 'ONE_V_ONE' | 'BATTLE_ROYALE' | 'CLAN_VS_CLAN' | 'GROUP';
export type BattleStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type MatchmakingStatus = 'QUEUED' | 'MATCHED' | 'EXPIRED';
export type SkillType = 'FREEZE' | 'SCRAMBLE' | 'BLIND' | 'TIME_STEAL' | 'FOG_OF_WAR';

export interface RankTier {
    name: string;
    icon: string;
    color: string;
    minMmr: number;
    maxMmr: number | null;
}

export interface User {
    id: string;
    email: string;
    username: string;
    avatarUrl: string | null;
    role: string;
    mmr: number;
    wins: number;
    losses: number;
    tier?: RankTier;
    createdAt: string;
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
