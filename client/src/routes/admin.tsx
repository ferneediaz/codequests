import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { AdminRoute } from '@/components/layout/AdminRoute';

const ReviewQueue = lazy(() => import('@/pages/admin/ReviewQueue'));
const ReviewSandbox = lazy(() => import('@/pages/admin/ReviewSandbox'));

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
