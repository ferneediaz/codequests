import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { OnboardingGate } from '@/components/layout/OnboardingGate';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import AuthCallback from '@/pages/AuthCallback';
import Dashboard from '@/pages/Dashboard';
import Play from '@/pages/Play';
import Lobby from '@/pages/Lobby';
import Matchmaking from '@/pages/Matchmaking';
import Battle from '@/pages/Battle';
import Results from '@/pages/Results';
import Practice from '@/pages/Practice';
import PracticeSolve from '@/pages/PracticeSolve';
import AuthorList from '@/pages/AuthorList';
import AuthorPreview from '@/pages/AuthorPreview';
import AuthorNew from '@/pages/AuthorNew';
import Onboarding from '@/pages/Onboarding';
import InviteJoin from '@/pages/InviteJoin';
import Pricing from '@/pages/Pricing';
import ClanPage from '@/pages/Clan';

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
                        element: <OnboardingGate />,
                        children: [
                            {
                                path: '/onboarding',
                                element: <Onboarding />,
                            },
                            {
                                path: '/dashboard',
                                element: <Dashboard />,
                            },
                            {
                                path: '/play',
                                element: <Play />,
                            },
                            {
                                path: '/lobby',
                                element: <Lobby />,
                            },
                            {
                                path: '/clan',
                                element: <ClanPage />,
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
                            {
                                path: '/pricing',
                                element: <Pricing />,
                            },
                            // Dev-only problem authoring tools. The server returns
                            // 404 unless ENABLE_AUTHOR_TOOLS=true, so these pages
                            // display a "disabled" message in production builds.
                            {
                                path: '/author',
                                element: <AuthorList />,
                            },
                            {
                                path: '/author/new',
                                element: <AuthorNew />,
                            },
                            {
                                path: '/author/problems/:slug',
                                element: <AuthorPreview />,
                            },
                        ],
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
