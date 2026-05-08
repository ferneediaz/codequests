import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const AuthorNew = lazy(() => import('@/pages/author/AuthorNew'));
const EditSubmission = lazy(() => import('@/pages/contribute/EditSubmission'));
const MySubmissions = lazy(() => import('@/pages/contribute/MySubmissions'));

export const contributeRoutes: RouteObject[] = [
    {
        path: '/contribute',
        element: <AuthorNew mode="submit" />,
    },
    {
        path: '/contribute/mine',
        element: <MySubmissions />,
    },
    {
        path: '/contribute/:id/edit',
        element: <EditSubmission />,
    },
];
