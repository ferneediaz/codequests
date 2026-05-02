export interface FriendRequestReceivedPayload {
    friendshipId: string;
    requesterId: string;
    requesterUsername: string;
    requesterAvatarUrl?: string | null;
    requesterMmr: number;
    createdAt: Date | string;
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

export interface FriendEventsPort {
    emitFriendRequestReceived(
        addresseeId: string,
        data: FriendRequestReceivedPayload,
    ): boolean;
    emitFriendRequestAccepted(
        requesterId: string,
        data: FriendRequestAcceptedPayload,
    ): boolean;
    emitFriendRequestDeclined(
        requesterId: string,
        data: FriendRequestDeclinedPayload,
    ): boolean;
}

export const FRIEND_EVENTS_PORT = 'FRIEND_EVENTS_PORT';
