import type { BattleStatus, SkillType } from './api';

export interface MatchFoundPayload {
    battleId: string;
    opponentId: string;
    matchedAt: string;
}

export interface BattleStartedPayload {
    battleId: string;
    status: BattleStatus;
    startedAt: string;
    problem: {
        id: string;
        title: string;
        description: string;
        difficulty: string;
        starterCode: string;
        testCases?: {
            id: string;
            input: string;
            expectedOutput: string;
            isHidden: boolean;
        }[];
    };
    participants: {
        userId: string;
        username: string;
        isReady: boolean;
    }[];
}

export interface BattleSubmissionPayload {
    userId: string;
    username: string;
    testsPassed: number;
    totalTests: number;
    submittedAt: string;
}

export interface BattleCompletedPayload {
    battleId: string;
    status: BattleStatus;
    winnerId: string;
    endedAt: string;
    participants: {
        userId: string;
        username: string;
        testsPassed: number;
        totalTests: number;
        mmrChange: number;
    }[];
}

export interface PlayerJoinedPayload {
    userId: string;
    username: string;
    battleId: string;
    joinedAt: string;
}

export interface PlayerLeftPayload {
    userId: string;
    username: string;
    battleId: string;
    leftAt: string;
}

export interface SkillEffectPayload {
    skillType: SkillType;
    fromUserId: string;
    duration: number;
}

export interface SkillUsedPayload {
    userId: string;
    skillType: SkillType;
    targetUserId: string;
}

export interface BattleStatusUpdatePayload {
    battleId: string;
    status: BattleStatus;
    updatedAt: string;
}

export interface InviteReceivedPayload {
    battleId: string;
    inviterUsername: string;
    inviterAvatarUrl?: string;
    battleMode: string;
    inviteCode: string;
}

export interface PlayerReadyPayload {
    userId: string;
    username: string;
    isReady: boolean;
}

export interface BattleTimeUpdatedPayload {
    battleId: string;
    startedAt: string;
    stolenSeconds: number;
    targetUserId: string;
    fromUserId: string;
}

export interface ChatMessagePayload {
    id: string;
    senderId: string;
    senderUsername: string;
    senderAvatarUrl?: string | null;
    content: string;
    roomType: 'LOBBY' | 'BATTLE' | 'DM';
    roomId: string;
    createdAt: string;
}
