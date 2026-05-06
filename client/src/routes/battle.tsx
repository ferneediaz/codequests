import type { RouteObject } from 'react-router-dom';
import Play from '@/pages/battle/Play';
import Lobby from '@/pages/battle/Lobby';
import Matchmaking from '@/pages/battle/Matchmaking';
import Battle from '@/pages/battle/Battle';
import Results from '@/pages/battle/Results';
import InviteJoin from '@/pages/battle/InviteJoin';

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
