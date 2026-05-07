import type {
    BattleParticipant,
    BattleStatus,
    ProblemResponse,
    SkillType,
} from './battle';

export interface MatchFoundPayload {
    battleId: string;
    opponentId: string;
    matchedAt: string;
}

export interface BattleStartedPayload {
    battleId: string;
    status: BattleStatus;
    startedAt: string;
    problem?: ProblemResponse;
    participants: Pick<BattleParticipant, 'userId' | 'username' | 'isReady'>[];
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
    participants: Array<
        Pick<
            BattleParticipant,
            'userId' | 'username' | 'testsPassed' | 'totalTests'
        > & { mmrChange: number }
    >;
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
    roomType: 'LOBBY' | 'BATTLE' | 'DM' | 'CLAN';
    roomId: string;
    createdAt: string;
}

export interface FriendRequestReceivedPayload {
    friendshipId: string;
    requesterId: string;
    requesterUsername: string;
    requesterAvatarUrl?: string | null;
    requesterMmr: number;
    createdAt: string;
}

export interface FriendRequestAcceptedPayload {
    friendshipId: string;
    friendId: string;
    friendUsername: string;
    friendAvatarUrl?: string | null;
    friendMmr: number;
}

export interface FriendRequestDeclinedPayload {
    friendshipId: string;
    addresseeId: string;
    addresseeUsername: string;
}

export interface AchievementUnlockedPayload {
    userId: string;
    achievementId: string;
    title: string;
    description: string;
    icon: string;
    tier: string;
    unlockedAt: string;
    /**
     * Set when the unlock fired from a battle. The Results page filters its
     * unlock-popup queue on this; the global notifications toast suppresses
     * itself when this is present (popup owns the surface).
     */
    battleId?: string;
}
