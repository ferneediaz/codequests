import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { OnboardingGate } from '@/components/layout/OnboardingGate';
import Landing from '@/pages/marketing/Landing';
import Login from '@/pages/auth/Login';
import AuthCallback from '@/pages/auth/AuthCallback';
import Dashboard from '@/pages/dashboard/Dashboard';
import Play from '@/pages/battle/Play';
import Lobby from '@/pages/battle/Lobby';
import Matchmaking from '@/pages/battle/Matchmaking';
import Battle from '@/pages/battle/Battle';
import Results from '@/pages/battle/Results';
import Practice from '@/pages/practice/Practice';
import PracticeSolve from '@/pages/practice/PracticeSolve';
import AuthorList from '@/pages/author/AuthorList';
import AuthorPreview from '@/pages/author/AuthorPreview';
import AuthorNew from '@/pages/author/AuthorNew';
import Onboarding from '@/pages/auth/Onboarding';
import InviteJoin from '@/pages/battle/InviteJoin';
import Pricing from '@/pages/marketing/Pricing';
import ClanPage from '@/pages/clan/Clan';

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
