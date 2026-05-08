import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const Play = lazy(() => import('@/pages/battle/Play'));
const QuickPlay = lazy(() => import('@/pages/battle/QuickPlay'));
const Lobby = lazy(() => import('@/pages/battle/Lobby'));
const Matchmaking = lazy(() => import('@/pages/battle/Matchmaking'));
const Battle = lazy(() => import('@/pages/battle/Battle'));
const Results = lazy(() => import('@/pages/battle/Results'));
const InviteJoin = lazy(() => import('@/pages/battle/InviteJoin'));

export const publicBattleRoutes: RouteObject[] = [
    // Unauthenticated users see a "sign in to join" prompt; authenticated
    // users get battle details + join action.
    {
        path: '/invite/:code',
        element: <InviteJoin />,
    },
];

export const protectedBattleRoutes: RouteObject[] = [
    {
        path: '/play',
        element: <Play />,
    },
    {
        path: '/play/quick',
        element: <QuickPlay />,
    },
    {
        path: '/lobby',
        element: <Lobby />,
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
];
