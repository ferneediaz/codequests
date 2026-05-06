import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useClanChallengeNotifications } from '@/hooks/useClanChallengeNotifications';
import { useInviteNotifications } from '@/hooks/useInviteNotifications';
import { useSubscription } from '@/hooks/useSubscription';
import { FriendNotificationsProvider } from '@/context/FriendNotificationsProvider';
import { NotificationsProvider } from '@/context/NotificationsProvider';
import {
    SocialLayoutContext,
    type DmTargetUser,
} from '@/context/socialLayoutContext';
import { FriendsSidebar } from '@/components/social/FriendsSidebar';
import { DmDrawer } from '@/components/lobby/DmDrawer';
import { useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';

interface OpenDmState {
    conversationId: string;
    user: DmTargetUser;
}

export function RootLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.auth.user);
    useInviteNotifications();
    useClanChallengeNotifications();
    // Initialize subscription state on app load. The hook is also used
    // ad-hoc by the paywall gate and the navbar badge — calling it here
    // guarantees the initial fetch happens once per session.
    useSubscription();
    const [friendsSidebarOpen, setFriendsSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(min-width: 1024px)').matches;
    });
    const [openDmState, setOpenDmState] = useState<OpenDmState | null>(null);
    const onMessagesRoute = location.pathname.startsWith('/messages');

    const friendsSidebarHidden = useMemo(() => {
        const path = location.pathname;
        return (
            path.startsWith('/battle/') ||
            path.startsWith('/messages') ||
            path.startsWith('/onboarding') ||
            path.startsWith('/login') ||
            path.startsWith('/auth/callback') ||
            path.startsWith('/invite/')
        );
    }, [location.pathname]);

    const toggleFriendsSidebar = useCallback(() => {
        setFriendsSidebarOpen((open) => !open);
    }, []);

    useEffect(() => {
        if (!onMessagesRoute) return;
        queueMicrotask(() => setOpenDmState(null));
    }, [onMessagesRoute]);

    const openDm = useCallback(
        (conversationId: string, otherUser: DmTargetUser) => {
            if (onMessagesRoute) {
                navigate(`/messages?c=${encodeURIComponent(conversationId)}`);
                return;
            }
            setOpenDmState({ conversationId, user: otherUser });
        },
        [navigate, onMessagesRoute],
    );

    const socialLayoutValue = useMemo(
        () => ({
            friendsSidebarOpen,
            setFriendsSidebarOpen,
            toggleFriendsSidebar,
            friendsSidebarHidden,
            openDm,
        }),
        [
            friendsSidebarHidden,
            friendsSidebarOpen,
            openDm,
            toggleFriendsSidebar,
        ],
    );

    const shouldRenderSidebar = friendsSidebarOpen && !friendsSidebarHidden;

    return (
        <NotificationsProvider>
            <FriendNotificationsProvider>
                <SocialLayoutContext.Provider value={socialLayoutValue}>
                <div className="flex min-h-screen flex-col bg-background">
                    <Navbar />
                    <div className="relative flex min-h-0 flex-1 overflow-hidden">
                        <main className="min-w-0 flex-1 overflow-y-auto">
                            <Outlet />
                        </main>
                        {shouldRenderSidebar && (
                            <>
                                <button
                                    type="button"
                                    aria-label="Close friends sidebar overlay"
                                    className="fixed inset-0 top-14 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
                                    onClick={() => setFriendsSidebarOpen(false)}
                                />
                                <aside
                                    className={cn(
                                        'fixed bottom-0 right-0 top-14 z-40 w-[320px] max-w-[88vw]',
                                        'lg:static lg:z-auto lg:h-auto lg:w-[320px] lg:max-w-none lg:shrink-0',
                                    )}
                                >
                                    <FriendsSidebar />
                                </aside>
                            </>
                        )}
                    </div>
                    {!onMessagesRoute && openDmState && (
                        <DmDrawer
                            conversationId={openDmState.conversationId}
                            otherUser={openDmState.user}
                            currentUserId={user?.id}
                            onClose={() => setOpenDmState(null)}
                        />
                    )}
                </div>
                </SocialLayoutContext.Provider>
            </FriendNotificationsProvider>
        </NotificationsProvider>
    );
}
