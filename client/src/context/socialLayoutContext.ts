import { createContext } from 'react';

export interface DmTargetUser {
    id: string;
    username: string;
    avatarUrl?: string | null;
    mmr?: number;
}

export interface SocialLayoutContextValue {
    friendsSidebarOpen: boolean;
    setFriendsSidebarOpen: (open: boolean) => void;
    toggleFriendsSidebar: () => void;
    friendsSidebarHidden: boolean;
    openDm: (conversationId: string, otherUser: DmTargetUser) => void;
}

export const SocialLayoutContext =
    createContext<SocialLayoutContextValue | null>(null);
