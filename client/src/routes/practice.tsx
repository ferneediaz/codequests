import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const Practice = lazy(() => import('@/pages/practice/Practice'));
const PracticeSolve = lazy(() => import('@/pages/practice/PracticeSolve'));

export const practiceRoutes: RouteObject[] = [
    {
        path: '/practice',
        element: <Practice />,
    },
    {
        path: '/practice/:problemId',
        element: <PracticeSolve />,
    },
];
