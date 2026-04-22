import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Play from '@/pages/Play';
import Matchmaking from '@/pages/Matchmaking';
import Battle from '@/pages/Battle';
import Results from '@/pages/Results';
import Practice from '@/pages/Practice';
import PracticeSolve from '@/pages/PracticeSolve';
import AuthorList from '@/pages/AuthorList';
import AuthorPreview from '@/pages/AuthorPreview';
import InviteJoin from '@/pages/InviteJoin';

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
            // Public invite landing page. Unauthenticated users see a
            // "sign in to join" prompt; authenticated users get battle
            // details + join action.
            {
                path: '/invite/:code',
                element: <InviteJoin />,
            },
            {
                element: <ProtectedRoute />,
                children: [
                    {
                        path: '/dashboard',
                        element: <Dashboard />,
                    },
                    {
                        path: '/play',
                        element: <Play />,
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
                    {
                        path: '/practice',
                        element: <Practice />,
                    },
                    {
                        path: '/practice/:problemId',
                        element: <PracticeSolve />,
                    },
                    // Dev-only problem authoring tools. The server returns
                    // 404 unless ENABLE_AUTHOR_TOOLS=true, so these pages
                    // display a "disabled" message in production builds.
                    {
                        path: '/author',
                        element: <AuthorList />,
                    },
                    {
                        path: '/author/problems/:slug',
                        element: <AuthorPreview />,
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
