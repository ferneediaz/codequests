import type { RouteObject } from 'react-router-dom';
import Landing from '@/pages/marketing/Landing';
import Pricing from '@/pages/marketing/Pricing';

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
