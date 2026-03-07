# CodeQuest Battles — Client

React + TypeScript frontend for the CodeQuest Battles platform.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool, dev server |
| **Redux Toolkit** | Global state management |
| **TanStack Query** | Server state, caching |
| **Socket.IO Client** | Real-time communication |
| **Monaco Editor** | Code editor component |
| **Tailwind CSS** | Utility-first styling |
| **React Router** | Client-side routing |

---

## Architecture

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # Base components (Button, Input, Modal, etc.)
│   ├── editor/          # Monaco editor wrapper & config
│   ├── battle/          # Battle-specific components
│   └── layout/          # Layout components (Header, Sidebar, etc.)
│
├── pages/               # Route pages
│   ├── Home/            # Landing page
│   ├── Auth/            # Login, Register, OAuth callback
│   ├── Dashboard/       # User dashboard
│   ├── Battle/          # Active battle view
│   ├── Lobby/           # Matchmaking lobby
│   ├── Clan/            # Clan management
│   ├── Leaderboard/     # Rankings
│   └── Profile/         # User profile
│
├── store/               # Redux store
│   ├── index.ts         # Store configuration
│   ├── slices/          # Redux slices
│   │   ├── authSlice.ts       # Auth state
│   │   ├── battleSlice.ts     # Battle state (opponent, progress, skills)
│   │   ├── matchmakingSlice.ts # Queue state
│   │   └── uiSlice.ts         # UI state (modals, notifications)
│   └── hooks.ts         # Typed useSelector/useDispatch
│
├── services/            # External service integrations
│   ├── api.ts           # REST API client (axios/fetch)
│   ├── socket.ts        # Socket.IO client instance
│   ├── supabase.ts      # Supabase client (auth)
│   └── codeExecution.ts # Code submission helpers
│
├── hooks/               # Custom React hooks
│   ├── useAuth.ts       # Auth state & actions
│   ├── useBattle.ts     # Battle state & socket events
│   ├── useMatchmaking.ts # Queue management
│   └── useSocket.ts     # Socket connection management
│
├── types/               # TypeScript type definitions
│   ├── api.ts           # API response types
│   ├── battle.ts        # Battle-related types
│   ├── user.ts          # User & profile types
│   └── socket.ts        # Socket event types
│
├── utils/               # Helper functions
│   ├── formatters.ts    # Date, time, MMR formatters
│   ├── validators.ts    # Form validation
│   └── constants.ts     # App constants
│
├── App.tsx              # Root component with providers
├── main.tsx             # Entry point
└── vite-env.d.ts        # Vite type declarations
```

---

## State Management Strategy

### Redux Toolkit (Global State)
Used for state that needs to be accessed across many components:

| Slice | Contents |
|-------|----------|
| `authSlice` | User session, profile, tokens |
| `battleSlice` | Current battle state, opponent info, progress, active skills |
| `matchmakingSlice` | Queue status, estimated wait time |
| `uiSlice` | Modal visibility, notifications, theme |

### TanStack Query (Server State)
Used for data fetched from the API:

- User profiles
- Leaderboards
- Clan data
- Problem lists
- Match history

---

## Paywall Implementation (Client)

The client enforces a **freemium model** (2 free games/day, then paywall):

### Components
| Component | Purpose |
|-----------|--------|
| `PaywallModal` | Shows upgrade prompt when free games exhausted |
| `GamesRemainingBadge` | Displays remaining free games count |
| `SubscriptionStatus` | Shows current plan in profile/header |
| `PricingPage` | Subscription plans & Stripe checkout |

### Redux State (`subscriptionSlice`)
```typescript
interface SubscriptionState {
  plan: 'free' | 'pro';
  gamesRemaining: number;      // Free games left today
  gamesPlayedToday: number;
  resetsAt: string;            // UTC timestamp
  stripeCustomerId?: string;
}
```

### Hooks
| Hook | Purpose |
|------|--------|
| `useSubscription` | Access subscription state & check access |
| `usePaywall` | Show paywall modal, check if can play |
| `useStripeCheckout` | Initiate Stripe checkout session |

### Flow
1. User clicks "Find Match"
2. `usePaywall.canPlay()` checks `gamesRemaining > 0 || plan === 'pro'`
3. If blocked → show `PaywallModal`
4. If allowed → proceed to matchmaking

### Local State (useState)
Used for component-specific state:

- Form inputs
- UI toggles
- Temporary selections

---

## Socket.IO Events

### Emitted (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `matchmaking:join` | `{ mode: '1v1' \| 'battle-royale' }` | Join matchmaking queue |
| `matchmaking:leave` | — | Leave queue |
| `battle:ready` | — | Player ready to start |
| `code:submit` | `{ code: string, language: string }` | Submit solution |
| `skill:use` | `{ skillId: string, targetId?: string }` | Activate a skill |

### Listened (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `matchmaking:found` | `{ battleId, opponent }` | Match found |
| `battle:start` | `{ problem, timeLimit }` | Battle begins |
| `battle:end` | `{ winner, stats }` | Battle concludes |
| `code:result` | `{ passed, testResults, time }` | Execution result |
| `skill:effect` | `{ skillId, duration }` | Skill applied to you |
| `opponent:progress` | `{ testsPasssed, totalTests }` | Opponent progress |

---

## Key Components

### `<CodeEditor />`
Monaco Editor wrapper with:
- Language selection
- Theme support (dark/light)
- Vim/Emacs keybindings (optional)
- Real-time skill effects (freeze overlay, code scramble animation)

### `<BattleView />`
Main battle interface:
- Split view: your editor + opponent progress
- Problem description panel
- Skill bar with cooldowns
- Timer and submission status

### `<MatchmakingLobby />`
Queue interface:
- Mode selection (1v1, Battle Royale)
- Estimated wait time
- Cancel button
- MMR range indicator

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

---

## Scripts

```bash
# Development
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

---

## Folder Conventions

- **Components**: PascalCase folders with `index.tsx` + `styles.css` (if needed)
- **Hooks**: `use` prefix, camelCase
- **Types**: Exported interfaces/types, no `I` prefix
- **Utils**: Pure functions, well-documented

---

## Testing

```bash
# Unit tests
pnpm test

# E2E tests (Playwright)
pnpm test:e2e
```

| Type | Tool | Location |
|------|------|----------|
| Unit | Vitest | `src/**/*.test.ts` |
| Component | React Testing Library | `src/**/*.test.tsx` |
| E2E | Playwright | `e2e/` |
