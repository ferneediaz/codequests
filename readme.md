# CodeQuest Battles

A competitive coding battle platform where players learn algorithms through real-time 1v1 duels and battle royale matches. Think LeetCode meets competitive gaming.

## Features

- **1v1 Battles** — Race to solve coding problems against opponents
- **Battle Royale** — Multi-round elimination with many players
- **Skills System** — Throw abilities at opponents (freeze, code scramble, etc.)
- **Clans** — Create/join clans, participate in clan wars
- **Ranked Matchmaking** — MMR-based system for fair competitive matches
- **Real-time Updates** — See opponent progress, skill effects live

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool, fast HMR |
| **Socket.IO Client** | Real-time battle communication |
| **Monaco Editor** | Code editor (same as VS Code) |
| **Redux Toolkit** | Client state management (battle state) |
| **TanStack Query** | Server state management |
| **Tailwind CSS** | Styling |

### Backend
| Technology | Purpose |
|------------|---------|
| **NestJS** | Node.js framework with TypeScript |
| **Socket.IO** | WebSocket server for real-time battles |
| **Prisma** | Database ORM |
| **Piston** | Sandboxed code execution engine (Docker) |

### Database & Auth
| Technology | Purpose |
|------------|---------|
| **Supabase** | Hosted PostgreSQL database |
| **Supabase Auth** | Authentication (Google, GitHub, email) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  React + TypeScript + Monaco Editor + Socket.IO Client      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     NESTJS BACKEND                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   REST API  │  │  Socket.IO  │  │  Code Execution     │  │
│  │  (Prisma)   │  │  Gateway    │  │  Service (Piston)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │   PostgreSQL DB     │  │   Auth (OAuth + Email)      │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Modules

| Module | Responsibility |
|--------|----------------|
| **Auth** | JWT validation, Supabase Auth integration |
| **Users** | Profiles, stats, match history |
| **Clans** | Clan CRUD, membership, clan wars |
| **Matchmaking** | MMR-based queue, battle royale lobbies |
| **Battles** | Real-time game state, skill effects, code submission |
| **Problems** | Coding problem CRUD, test cases |
| **Code Execution** | Piston integration, result validation |
| **Rankings** | MMR calculations, leaderboards |

---

## Real-time Events (Socket.IO)

| Event | Description |
|-------|-------------|
| `battle:join` | Player joins a battle room |
| `battle:start` | Battle countdown begins |
| `battle:end` | Battle concludes, results sent |
| `code:submit` | Player submits code solution |
| `code:result` | Execution result returned |
| `skill:use` | Player activates a skill |
| `skill:effect` | Skill effect applied to opponent |
| `opponent:progress` | Live opponent progress update |

---

## Monetization (Paywall)

CodeQuest Battles uses a **freemium model** similar to GeoGuessr:

### Free Tier
- **2 free games per day** (resets at midnight UTC)
- Access to casual matchmaking
- Basic profile features

### Pro Subscription
- **Unlimited games**
- Access to ranked matchmaking
- Battle Royale mode
- Clan features & clan wars
- Priority matchmaking
- Exclusive cosmetics & badges
- Match history & analytics

### Implementation
- Game count tracked per user (resets daily)
- Paywall check before matchmaking queue join
- Stripe integration for subscription management
- Webhook handlers for subscription lifecycle events

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm (recommended) or npm
- Supabase account
- Docker (for Piston code execution engine)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd codequest_battles

# Install client dependencies
cd client
pnpm install

# Install server dependencies
cd ../server
pnpm install
```

### Environment Variables

**Client** (`client/.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3000
```

**Server** (`server/.env`):
```env
DATABASE_URL=your_supabase_postgres_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
PISTON_URL=http://localhost:2000
JWT_SECRET=your_jwt_secret
```

### Development

```bash
# Start the server
cd server
pnpm run start:dev

# Start the client (in another terminal)
cd client
pnpm run dev
```

---

## Project Structure

```
codequest_battles/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Route pages
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API & Socket.IO clients
│   │   └── types/          # TypeScript types
│   └── ...
├── server/                 # NestJS backend
│   ├── src/
│   │   ├── auth/           # Auth module
│   │   ├── users/          # Users module
│   │   ├── clans/          # Clans module
│   │   ├── matchmaking/    # Matchmaking module
│   │   ├── battles/        # Battles module (Socket.IO gateway)
│   │   ├── problems/       # Problems module
│   │   ├── code-execution/ # Piston code execution
│   │   └── rankings/       # Rankings module
│   └── ...
└── readme.md
```

---

## License

MIT

