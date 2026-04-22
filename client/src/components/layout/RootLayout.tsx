import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useInviteNotifications } from '@/hooks/useInviteNotifications';
import { useSubscription } from '@/hooks/useSubscription';

export function RootLayout() {
    useInviteNotifications();
    // Initialize subscription state on app load. The hook is also used
    // ad-hoc by the paywall gate and the navbar badge — calling it here
    // guarantees the initial fetch happens once per session.
    useSubscription();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
