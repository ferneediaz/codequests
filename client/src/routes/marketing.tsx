import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import Landing from '@/pages/marketing/Landing';

const Pricing = lazy(() => import('@/pages/marketing/Pricing'));

export const publicMarketingRoutes: RouteObject[] = [
    {
        path: '/',
        element: <Landing />,
    },
];

export const protectedMarketingRoutes: RouteObject[] = [
    {
        path: '/pricing',
        element: <Pricing />,
    },
];
