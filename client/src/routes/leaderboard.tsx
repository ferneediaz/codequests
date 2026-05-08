import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const Leaderboard = lazy(() => import('@/pages/leaderboard/Leaderboard'));

export const leaderboardRoutes: RouteObject[] = [
    {
        path: '/leaderboard',
        element: <Leaderboard />,
    },
];
