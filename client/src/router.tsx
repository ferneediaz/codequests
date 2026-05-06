import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { OnboardingGate } from '@/components/layout/OnboardingGate';
import { authorRoutes } from '@/routes/author';
import { protectedAuthRoutes, publicAuthRoutes } from '@/routes/auth';
import { protectedBattleRoutes, publicBattleRoutes } from '@/routes/battle';
import { clanRoutes } from '@/routes/clan';
import { dashboardRoutes } from '@/routes/dashboard';
import { protectedMarketingRoutes, publicMarketingRoutes } from '@/routes/marketing';
import { practiceRoutes } from '@/routes/practice';
import Messages from '@/pages/messages/Messages';

export const router = createBrowserRouter([
    ...publicMarketingRoutes,
    {
        element: <RootLayout />,
        children: [
            ...publicAuthRoutes,
            ...publicBattleRoutes,
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
