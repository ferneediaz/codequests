# Client Architecture

This client is organized around a small split between server state, UI state,
and realtime events.

## Routing

`src/router.tsx` composes feature route arrays from `src/routes/`. Public routes
live beside protected routes by feature, while `ProtectedRoute` and
`OnboardingGate` stay in the root router because they define the shared access
boundary.

## Data Ownership

TanStack Query owns server-shaped data:

- battle and problem records (`useBattleData`)
- dashboard user stats, match history, news, and GitHub activity
- practice problem lists, practice stats, and problem details

Query keys are centralized in `src/lib/queryKeys.ts`. Service modules under
`src/services/` own HTTP details so pages and hooks can call named operations
instead of constructing URLs inline.

Redux owns cross-component UI/session state:

- auth user/session state
- subscription status and loading/error flags
- battle UI state such as `isSubmitting`, `isRunning`, `usedSkills`, and
  `activeEffects`

Redux should not store REST-loaded battle/problem objects. Keep those in
TanStack Query so socket events and fetches update the same cache.

## Battle Socket Flow

`useBattle.ts` is a facade over three hooks:

- `useBattleData` fetches the battle and its problem through TanStack Query.
- `useBattleSocket` joins/leaves the socket room, listens for battle events,
  and patches the query cache for battle/problem changes.
- `useBattleActions` handles submit/run/skill/ready actions and battle UI
  flags.

Socket payload types live in `src/types/socket.ts` and reuse API domain types
from `src/types/battle.ts` where payloads mirror REST entities.

## Paywall Flow

`useSubscription` loads subscription status and exposes derived booleans like
`isPro`, `isDev`, and `canPlay`. `usePaywall` is the UI-facing gate used before
starting paid or limited actions. The server remains the source of truth and may
reject API calls even if the client-side hint says an action can proceed.

The Pricing page handles Stripe return states, refreshes subscription status,
and removes checkout query params after showing the user-facing toast.

## Types

Domain types live under `src/types/`:

- `battle.ts` for battle, problem, matchmaking, skills, and submissions
- `user.ts` for auth user, onboarding, rank, stats, and match history
- `news.ts` for dashboard/news feed payloads
- `clan.ts` for shared clan references
- `common.ts` for shared primitives such as difficulty

`src/types/api.ts` remains a compatibility barrel so existing imports can
continue to use `@/types/api` while new code can import from domain files.
