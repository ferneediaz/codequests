import { lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

const ClansDirectory = lazy(() => import('@/pages/clan/ClansDirectory'));
const ClanCreate = lazy(() => import('@/pages/clan/ClanCreate'));
const ClanDetail = lazy(() => import('@/pages/clan/ClanDetail'));

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
