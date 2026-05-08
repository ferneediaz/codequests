import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';

const AuthorList = lazy(() => import('@/pages/author/AuthorList'));
const AuthorNew = lazy(() => import('@/pages/author/AuthorNew'));
const AuthorPreview = lazy(() => import('@/pages/author/AuthorPreview'));

// Dev-only problem authoring tools. Mounted only in dev builds — the
// user-facing contribution flow lives at `/contribute` (see
// `routes/contribute.tsx`). The server still gates `/author` endpoints with
// `ENABLE_AUTHOR_TOOLS=true`, so these pages display a disabled message
// outside of dev anyway.
export const authorRoutes: RouteObject[] = import.meta.env.DEV
    ? [
          {
              path: '/author',
              element: <AuthorList />,
          },
          {
              path: '/author/new',
              element: <AuthorNew mode="yaml-copy" />,
          },
          {
              path: '/author/problems/:slug',
              element: <AuthorPreview />,
          },
      ]
    : [];
