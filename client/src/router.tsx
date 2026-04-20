import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Matchmaking from '@/pages/Matchmaking';
import Battle from '@/pages/Battle';
import Results from '@/pages/Results';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <Landing />,
    },
    {
        element: <RootLayout />,
        children: [
            {
                path: '/login',
                element: <Login />,
            },
            {
                path: '/auth/callback',
                element: <AuthCallback />,
            },
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        path: '/dashboard',
                        element: <Dashboard />,
                    },
                    {
                        path: '/matchmaking',
                        element: <Matchmaking />,
                    },
                    {
                        path: '/battle/:id',
                        element: <Battle />,
                    },
                    {
                        path: '/battle/:id/results',
                        element: <Results />,
                    },
                ],
            },
            {
                path: '*',
                element: <Navigate to="/" replace />,
            },
        ],
    },
]);
