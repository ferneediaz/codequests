import type { RouteObject } from 'react-router-dom';
import { AdminRoute } from '@/components/layout/AdminRoute';
import ReviewQueue from '@/pages/admin/ReviewQueue';
import ReviewSandbox from '@/pages/admin/ReviewSandbox';

export const adminRoutes: RouteObject[] = [
    {
        element: <AdminRoute />,
        children: [
            {
                path: '/admin/review',
                element: <ReviewQueue />,
            },
            {
                path: '/admin/review/:id',
                element: <ReviewSandbox />,
            },
        ],
    },
];
