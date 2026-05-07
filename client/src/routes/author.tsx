import type { RouteObject } from 'react-router-dom';
import AuthorList from '@/pages/author/AuthorList';
import AuthorNew from '@/pages/author/AuthorNew';
import AuthorPreview from '@/pages/author/AuthorPreview';

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
