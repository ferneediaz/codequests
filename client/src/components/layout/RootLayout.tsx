import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useInviteNotifications } from '@/hooks/useInviteNotifications';

export function RootLayout() {
    useInviteNotifications();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}
