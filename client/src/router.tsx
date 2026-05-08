import { createBrowserRouter } from 'react-router-dom';
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
import { leaderboardRoutes } from '@/routes/leaderboard';
import { protectedMarketingRoutes, publicMarketingRoutes } from '@/routes/marketing';
import { practiceRoutes } from '@/routes/practice';
import { publicProfileRoutes } from '@/routes/profile';
import Messages from '@/pages/messages/Messages';
import NotFound from '@/pages/error/NotFound';

export const router = createBrowserRouter([
    ...publicMarketingRoutes,
    {
        element: <RootLayout />,
        children: [
            ...publicAuthRoutes,
            ...publicBattleRoutes,
            ...publicProfileRoutes,
            ...leaderboardRoutes,
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
                element: <NotFound />,
            },
        ],
    },
]);
