import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const Profile = lazy(() => import('@/pages/profile/Profile'));

export const publicProfileRoutes: RouteObject[] = [
    {
        path: '/profile/:username',
        element: <Profile />,
    },
];
