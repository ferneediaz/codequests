import type { RouteObject } from 'react-router-dom';
import Practice from '@/pages/practice/Practice';
import PracticeSolve from '@/pages/practice/PracticeSolve';

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
