import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getChatSocket, getSocket } from '@/services/socket';
import type {
    AchievementUnlockedPayload,
    ChatMessagePayload,
} from '@/types/socket';
import { queryKeys } from '@/lib/queryKeys';
import {
    NotificationsContext,
    type InAppNotification,
    type NotificationsContextValue,
} from './notificationsContext';

const STORAGE_KEY = 'codequest.notifications';

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
        } catch {
            return [];
        }
    });

    useEffect(() => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(notifications.slice(0, 30)),
        );
    }, [notifications]);

    const push = useCallback(
        (notification: Omit<InAppNotification, 'id' | 'createdAt' | 'read'>) => {
            const item: InAppNotification = {
                ...notification,
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                createdAt: new Date().toISOString(),
                read: false,
            };
            setNotifications((prev) => [item, ...prev].slice(0, 30));
            toast(item.title, {
                description: item.body,
                action: item.href
                    ? {
                          label: 'View',
                          onClick: () => navigate(item.href ?? '/dashboard'),
                      }
                    : undefined,
            });
        },
        [navigate],
    );

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onFriendRequest = (data: { requesterUsername?: string }) => {
            push({
                kind: 'FRIEND_REQUEST',
                title: `${data.requesterUsername ?? 'Someone'} sent you a friend request`,
                href: '/dashboard',
            });
        };
        const onClanChallenge = (data: { challengerClan?: { name?: string }; challengedClan?: { id?: string } }) => {
            push({
                kind: 'CLAN_CHALLENGE',
                title: `${data.challengerClan?.name ?? 'A clan'} challenged your clan`,
                href: data.challengedClan?.id ? `/clans/${data.challengedClan.id}` : '/clans',
            });
        };
        const onJoinRequest = (data: { clan?: { id?: string }; user?: { username?: string } }) => {
            push({
                kind: 'CLAN_JOIN_REQUEST',
                title: `${data.user?.username ?? 'A player'} requested to join your clan`,
                href: data.clan?.id ? `/clans/${data.clan.id}` : '/clans',
            });
        };
        const onInvite = (data: { fromUsername?: string; inviteCode?: string }) => {
            push({
                kind: 'BATTLE_INVITE',
                title: `${data.fromUsername ?? 'A player'} invited you to battle`,
                href: data.inviteCode ? `/invite/${data.inviteCode}` : '/lobby',
            });
        };
        const onMatched = (data: { battleId?: string }) => {
            push({
                kind: 'MATCH_FOUND',
                title: 'Your match is ready',
                href: data.battleId ? `/battle/${data.battleId}` : '/matchmaking',
            });
        };
        const onSubmissionForReview = (data: {
            submissionId?: string;
            title?: string;
            submitterUsername?: string;
        }) => {
            push({
                kind: 'PROBLEM_SUBMITTED',
                title: `${data.submitterUsername ?? 'Someone'} submitted a problem`,
                body: data.title,
                href: data.submissionId
                    ? `/admin/review/${data.submissionId}`
                    : '/admin/review',
            });
        };
        const onSubmissionApproved = (data: {
            title?: string;
            linkedProblemId?: string | null;
        }) => {
            push({
                kind: 'PROBLEM_APPROVED',
                title: 'Your problem was approved',
                body: data.title,
                href: data.linkedProblemId
                    ? `/practice/${data.linkedProblemId}`
                    : '/contribute/mine',
            });
        };
        const onSubmissionRejected = (data: { title?: string; reviewNotes?: string | null }) => {
            push({
                kind: 'PROBLEM_REJECTED',
                title: 'Your submission was rejected',
                body: data.reviewNotes ?? data.title,
                href: '/contribute/mine',
            });
        };
        const onSubmissionChangesRequested = (data: {
            title?: string;
            reviewNotes?: string | null;
            submissionId?: string;
        }) => {
            push({
                kind: 'PROBLEM_CHANGES_REQUESTED',
                title: 'Changes requested on your submission',
                body: data.reviewNotes ?? data.title,
                href: data.submissionId
                    ? `/contribute/${data.submissionId}/edit`
                    : '/contribute/mine',
            });
        };
        const onAchievementUnlocked = (data: AchievementUnlockedPayload) => {
            // Invalidate so the dashboard / profile grids re-fetch and the
            // newly unlocked badge flips from greyscale to colored.
            void queryClient.invalidateQueries({
                queryKey: queryKeys.achievements.mine(),
            });
            push({
                kind: 'ACHIEVEMENT_UNLOCKED',
                title: `Achievement unlocked: ${data.title}`,
                body: data.description,
                href: '/dashboard',
            });
        };

        socket.on('friend.request_received', onFriendRequest);
        socket.on('clan.challenge_received', onClanChallenge);
        socket.on('clan.join_request_received', onJoinRequest);
        socket.on('battle.invite_received', onInvite);
        socket.on('matchmaking.matched', onMatched);
        socket.on('submission.new_for_review', onSubmissionForReview);
        socket.on('submission.approved', onSubmissionApproved);
        socket.on('submission.rejected', onSubmissionRejected);
        socket.on('submission.changes_requested', onSubmissionChangesRequested);
        socket.on('achievement.unlocked', onAchievementUnlocked);
        return () => {
            socket.off('friend.request_received', onFriendRequest);
            socket.off('clan.challenge_received', onClanChallenge);
            socket.off('clan.join_request_received', onJoinRequest);
            socket.off('battle.invite_received', onInvite);
            socket.off('matchmaking.matched', onMatched);
            socket.off('submission.new_for_review', onSubmissionForReview);
            socket.off('submission.approved', onSubmissionApproved);
            socket.off('submission.rejected', onSubmissionRejected);
            socket.off('submission.changes_requested', onSubmissionChangesRequested);
            socket.off('achievement.unlocked', onAchievementUnlocked);
        };
    }, [push, queryClient]);

    useEffect(() => {
        const socket = getChatSocket();
        if (!socket) return;
        const onMessage = (message: ChatMessagePayload) => {
            if (message.roomType !== 'DM') return;
            push({
                kind: 'DM',
                title: `New message from ${message.senderUsername}`,
                body: message.content,
                href: `/messages?c=${encodeURIComponent(message.roomId)}`,
            });
        };
        socket.on('chat.message', onMessage);
        return () => {
            socket.off('chat.message', onMessage);
        };
    }, [push]);

    const markRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    }, []);

    const value = useMemo<NotificationsContextValue>(
        () => ({
            notifications,
            unreadCount: notifications.filter((item) => !item.read).length,
            markRead,
            markAllRead,
        }),
        [markAllRead, markRead, notifications],
    );

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
}

