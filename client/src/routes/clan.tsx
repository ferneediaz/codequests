import { Navigate, type RouteObject } from 'react-router-dom';
import ClansDirectory from '@/pages/clan/ClansDirectory';
import ClanCreate from '@/pages/clan/ClanCreate';
import ClanDetail from '@/pages/clan/ClanDetail';

export const clanRoutes: RouteObject[] = [
    {
        path: '/clan',
        element: <Navigate to="/clans" replace />,
    },
    {
        path: '/clans',
        element: <ClansDirectory />,
    },
    {
        path: '/clans/create',
        element: <ClanCreate />,
    },
    {
        path: '/clans/:id',
        element: <ClanDetail />,
    },
];
