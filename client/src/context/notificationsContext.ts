import { createContext, useContext } from 'react';

export interface InAppNotification {
    id: string;
    kind:
        | 'MATCH_FOUND'
        | 'BATTLE_INVITE'
        | 'FRIEND_REQUEST'
        | 'CLAN_CHALLENGE'
        | 'CLAN_JOIN_REQUEST'
        | 'DM'
        | 'PROBLEM_SUBMITTED'
        | 'PROBLEM_APPROVED'
        | 'PROBLEM_REJECTED'
        | 'PROBLEM_CHANGES_REQUESTED'
        | 'ACHIEVEMENT_UNLOCKED';
    title: string;
    body?: string;
    href?: string;
    createdAt: string;
    read: boolean;
}

export interface NotificationsContextValue {
    notifications: InAppNotification[];
    unreadCount: number;
    markRead: (id: string) => void;
    markAllRead: () => void;
}

export const NotificationsContext =
    createContext<NotificationsContextValue | null>(null);

export function useNotifications() {
    const value = useContext(NotificationsContext);
    if (!value) {
        throw new Error('useNotifications must be used inside NotificationsProvider');
    }
    return value;
}
