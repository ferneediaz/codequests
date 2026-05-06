import type { RouteObject } from 'react-router-dom';
import ClanPage from '@/pages/clan/Clan';

export const clanRoutes: RouteObject[] = [
    {
        path: '/clan',
        element: <ClanPage />,
    },
];
