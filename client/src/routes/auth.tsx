import type { RouteObject } from 'react-router-dom';
import Login from '@/pages/auth/Login';
import AuthCallback from '@/pages/auth/AuthCallback';
import Onboarding from '@/pages/auth/Onboarding';

export const publicAuthRoutes: RouteObject[] = [
    {
        path: '/login',
        element: <Login />,
    },
    {
        path: '/auth/callback',
        element: <AuthCallback />,
    },
];

export const protectedAuthRoutes: RouteObject[] = [
    {
        path: '/onboarding',
        element: <Onboarding />,
    },
];
