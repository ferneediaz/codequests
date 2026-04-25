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
- **1 free games per day** (resets at midnight UTC)
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

## Getting Started (Local Development)

### Prerequisites
- Node.js 20+ (Node 22+ recommended)
- npm 10+
- Docker (required for local Piston code execution)
- A Supabase project (database + auth keys)

### 1) Install dependencies

From the repository root:

```bash
npm install
cd client && npm install
cd ../server && npm install
```

### 2) Configure environment variables

Copy both example env files:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Update values in:

- `client/.env`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL` (default `http://localhost:3000/api`)
  - `VITE_WS_URL` (default `http://localhost:3000`)
- `server/.env`
  - `DATABASE_URL` (Supabase Postgres connection string)
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`
  - `JWT_JWK` (Supabase JWT public key JWK JSON)
  - `PISTON_URL` (default `http://localhost:2000`)
  - `PORT` (default `3000`)

### 3) Start required local services

Start Piston from the `server` folder:

```bash
cd server
docker compose up -d
```

### 4) Apply database schema (first run)

From `server`:

```bash
npm run prisma:generate
npm run prisma:push
```

Optional seed:

```bash
npm run prisma:seed
```

### 5) Start development servers

Use 2 terminals:

Terminal 1 (backend, from `server`):

```bash
npm run start:dev
```

Terminal 2 (frontend, from `client`):

```bash
npm run dev
```

App URLs:
- Frontend: `http://localhost:5173`
- API: `http://localhost:3000/api`

### Optional: Run multiple client sessions

From repo root, this starts multiple Vite sessions on consecutive ports:

```bash
./run_client.sh 3
```

Example output ports: `5173`, `5174`, `5175`.

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

