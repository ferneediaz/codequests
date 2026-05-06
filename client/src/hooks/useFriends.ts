import { useContext } from 'react';
import {
    FriendNotificationsContext,
    type FriendNotificationsContextValue,
} from '@/context/friendNotificationsContext';

/**
 * Unified friends facade used by the sidebar, notification bell, and lobby.
 * Server-backed lists are owned by FriendNotificationsProvider so every
 * surface stays in sync after socket events or mutations.
 */
export function useFriends(): FriendNotificationsContextValue {
    const ctx = useContext(FriendNotificationsContext);
    if (!ctx) {
        throw new Error('useFriends must be used within FriendNotificationsProvider');
    }
    return ctx;
}
