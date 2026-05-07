import type { RouteObject } from 'react-router-dom';
import Profile from '@/pages/profile/Profile';

export const publicProfileRoutes: RouteObject[] = [
    {
        path: '/profile/:username',
        element: <Profile />,
    },
];
