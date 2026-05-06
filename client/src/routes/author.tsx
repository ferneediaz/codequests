import type { RouteObject } from 'react-router-dom';
import AuthorList from '@/pages/author/AuthorList';
import AuthorNew from '@/pages/author/AuthorNew';
import AuthorPreview from '@/pages/author/AuthorPreview';

// Dev-only problem authoring tools. The server returns 404 unless
// ENABLE_AUTHOR_TOOLS=true, so these pages display a disabled message in
// production builds.
export const authorRoutes: RouteObject[] = [
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
];
