import { createContext } from 'react';
import type { PendingRequest } from '@/services/friends';
import type { FriendRequestAcceptedPayload } from '@/types/socket';

export interface FriendNotificationsContextValue {
    pendingRequests: PendingRequest[];
    recentAccepted: FriendRequestAcceptedPayload[];
    unreadCount: number;
    loading: boolean;
    refresh: () => Promise<void>;
    accept: (friendshipId: string) => Promise<void>;
    decline: (friendshipId: string) => Promise<void>;
    markAllSeen: () => void;
}

// Lives in its own module so the provider component and the consumer
// hook can share the context reference without tripping React Fast
// Refresh's "only-export-components" rule.
export const FriendNotificationsContext =
    createContext<FriendNotificationsContextValue | null>(null);
