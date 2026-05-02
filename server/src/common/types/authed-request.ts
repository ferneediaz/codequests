import type { Request } from 'express';

// `role` stays loosely typed as `string` because Supabase ships role labels
// in the JWT (e.g. "authenticated", "admin") that aren't modelled as a
// Prisma enum. `email` is optional only because the shape of `req.user` is
// the union of "DB user" and "first-login JWT payload"; in practice both
// branches populate it.
export type AuthedRequest = Request & {
  user: { id: string; email?: string; role?: string };
};
