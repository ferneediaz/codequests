import type { RouteObject } from 'react-router-dom';
import Leaderboard from '@/pages/leaderboard/Leaderboard';

export const leaderboardRoutes: RouteObject[] = [
    {
        path: '/leaderboard',
        element: <Leaderboard />,
    },
];
