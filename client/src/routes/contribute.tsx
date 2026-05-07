import type { RouteObject } from 'react-router-dom';
import AuthorNew from '@/pages/author/AuthorNew';
import EditSubmission from '@/pages/contribute/EditSubmission';
import MySubmissions from '@/pages/contribute/MySubmissions';

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
