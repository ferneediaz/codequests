export type LobbyFriendship =
    | 'NONE'
    | 'PENDING_OUT'
    | 'PENDING_IN'
    | 'ACCEPTED'
    | 'SELF';

export interface LobbyClanSummary {
    id: string;
    name: string;
    tag: string;
    mmr: number;
}

export interface LobbyUser {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    clan?: LobbyClanSummary | null;
    friendship: LobbyFriendship;
    friendshipId?: string | null;
}

export interface LobbyClan {
    id: string;
    name: string;
    tag: string;
    mmr: number;
    memberCount: number;
    onlineCount: number;
}

export interface LobbySnapshot {
    users: LobbyUser[];
    clans: LobbyClan[];
    onlineCount: number;
}

export interface LobbyPresenceUser {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    clan?: LobbyClanSummary | null;
}

export interface LobbyPresenceDelta {
    type: 'online' | 'offline';
    user: LobbyPresenceUser;
}

export interface LobbyChallengeResponse {
    battleId: string;
    inviteCode: string | null;
    delivered: boolean;
}
