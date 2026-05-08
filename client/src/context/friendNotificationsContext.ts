import { createContext } from 'react';
import type { FriendRecord, PendingRequest } from '@/services/friends';
import type { FriendRequestAcceptedPayload } from '@/types/socket';
import type { LobbyUser } from '@/types/lobby';

export interface OutgoingFriendRequest {
    friendshipId: string;
    addresseeId: string;
    username: string;
    avatarUrl?: string | null;
    mmr: number;
    createdAt: string;
}

export interface FriendNotificationsContextValue {
    friends: FriendRecord[];
    onlineFriendIds: Set<string>;
    pendingRequests: PendingRequest[];
    outgoingRequests: OutgoingFriendRequest[];
    recentAccepted: FriendRequestAcceptedPayload[];
    unreadCount: number;
    loading: boolean;
    refresh: () => Promise<void>;
    accept: (friendshipId: string) => Promise<void>;
    decline: (friendshipId: string) => Promise<void>;
    remove: (friendUserId: string) => Promise<void>;
    sendRequestByUsername: (username: string) => Promise<void>;
    cancelOutgoingRequest: (friendshipId: string) => Promise<void>;
    seedOutgoingRequest: (user: LobbyUser) => void;
    isFriendOnline: (friendUserId: string) => boolean;
    markAllSeen: () => void;
}

// Lives in its own module so the provider component and the consumer
// hook can share the context reference without tripping React Fast
// Refresh's "only-export-components" rule.
export const FriendNotificationsContext =
    createContext<FriendNotificationsContextValue | null>(null);
