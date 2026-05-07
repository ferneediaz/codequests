import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { OnboardingGate } from '@/components/layout/OnboardingGate';
import { authorRoutes } from '@/routes/author';
import { adminRoutes } from '@/routes/admin';
import { contributeRoutes } from '@/routes/contribute';
import { protectedAuthRoutes, publicAuthRoutes } from '@/routes/auth';
import { protectedBattleRoutes, publicBattleRoutes } from '@/routes/battle';
import { clanRoutes } from '@/routes/clan';
import { dashboardRoutes } from '@/routes/dashboard';
import { protectedMarketingRoutes, publicMarketingRoutes } from '@/routes/marketing';
import { practiceRoutes } from '@/routes/practice';
import { publicProfileRoutes } from '@/routes/profile';
import Messages from '@/pages/messages/Messages';

export const router = createBrowserRouter([
    ...publicMarketingRoutes,
    {
        element: <RootLayout />,
        children: [
            ...publicAuthRoutes,
            ...publicBattleRoutes,
            ...publicProfileRoutes,
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        element: <OnboardingGate />,
                        children: [
                            ...protectedAuthRoutes,
                            ...dashboardRoutes,
                            ...protectedBattleRoutes,
                            ...clanRoutes,
                            {
                                path: '/messages',
                                element: <Messages />,
                            },
                            ...practiceRoutes,
                            ...protectedMarketingRoutes,
                            ...contributeRoutes,
                            ...adminRoutes,
                            ...authorRoutes,
                        ],
                    },
                ],
            },
            {
                path: '*',
                element: <Navigate to="/" replace />,
            },
        ],
    },
]);
