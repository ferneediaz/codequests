# CodeQuest Battles — Server

NestJS backend for the CodeQuest Battles platform.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (or Supabase account)
- (Optional) Judge0 API access for code execution

### Environment Setup

Create a `.env` file in the `server/` directory:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# JWT Configuration (Supabase JWK)
JWT_JWK='{"kty":"EC","crv":"P-256","x":"...","y":"..."}'

# Judge0 (Optional - for code execution)
JUDGE0_URL="https://judge0-ce.p.rapidapi.com"
JUDGE0_API_KEY="your-rapidapi-key"  # Optional for self-hosted
```

### Installation & Setup

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Sync database schema (development)
npm run prisma:push

# Seed database with sample data (users + problems)
npm run prisma:seed

# Start development server
npm run start:dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start server in watch mode |
| `npm run build` | Build for production |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |
| `npm run prisma:seed` | Seed database with sample data |

### API Documentation

Once the server is running, visit:
- **Swagger UI**: `http://localhost:3000/api/docs`

### Default Admin Account

After running the seed script, you can use this admin account:

- **Email**: `admin@codequest.dev`
- **Username**: `admin`
- **Role**: `admin`

*(Note: You'll need to authenticate via Supabase with this email to get a JWT token)*

### Sample Data

The seed script creates:
- 1 admin user + 2 regular users
- 7 coding problems (2 EASY, 3 MEDIUM, 2 HARD)
- Each problem includes visible and hidden test cases

---

## Agent Rules

> **IMPORTANT**: These rules MUST be followed when generating or modifying code in this project.

1. **NEVER use `any` type** — Always use proper TypeScript types. Use `unknown` if the type is truly unknown, then narrow it.
2. **Always type function parameters** — Every parameter must have an explicit type annotation.
3. **Always type return values** — Functions should have explicit return type annotations.
4. **Use interfaces/types for objects** — Define interfaces for request objects, payloads, and data structures.
5. **Use DTOs for all API inputs** — Never accept untyped request bodies.
6. **Prefer `unknown` over `any`** — When type is uncertain, use `unknown` and type-guard it.

```typescript
// ❌ BAD - Never do this
async handleRequest(req, payload) { }

// ✅ GOOD - Always do this
async handleRequest(req: Request, payload: CreateUserDto): Promise<User> { }
```

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **NestJS** | Node.js framework |
| **TypeScript** | Type safety |
| **Socket.IO** | Real-time WebSocket communication |
| **Prisma** | Database ORM |
| **Supabase** | PostgreSQL database + Auth |
| **Judge0** | Code execution engine |
| **class-validator** | DTO validation |
| **Passport** | Auth strategies (JWT) |

---

## Architecture

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
│
├── common/                    # Shared utilities
│   ├── decorators/            # Custom decorators
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/                # Auth & role guards
│   │   ├── jwt-auth.guard.ts
│   │   ├── ws-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── filters/               # Exception filters
│   │   └── http-exception.filter.ts
│   ├── interceptors/          # Response interceptors
│   │   └── transform.interceptor.ts
│   ├── pipes/                 # Validation pipes
│   └── types/                 # Shared types
│
├── config/                    # Configuration
│   ├── config.module.ts
│   ├── database.config.ts
│   ├── supabase.config.ts
│   └── judge0.config.ts
│
├── auth/                      # Authentication module (✅ Implemented)
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── dto/
│       └── sync-user.dto.ts
│
├── users/                     # Users module (✅ Implemented)
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       ├── update-user.dto.ts
│       └── user-response.dto.ts
│
├── problems/                  # Problems module (✅ Implemented)
│   ├── problems.module.ts
│   ├── problems.controller.ts
│   ├── problems.service.ts
│   └── dto/
│       ├── create-problem.dto.ts
│       ├── update-problem.dto.ts
│       └── problem-response.dto.ts
│
├── code-execution/            # Code execution module (✅ Implemented)
│   ├── code-execution.module.ts
│   ├── code-execution.service.ts
│   └── judge0.client.ts
│
├── clans/                     # Clans module (🔜 TODO)
│   ├── clans.module.ts
│   ├── clans.controller.ts
│   ├── clans.service.ts
│   ├── dto/
│   │   ├── create-clan.dto.ts
│   │   └── join-clan.dto.ts
│   └── entities/
│       └── clan.entity.ts
│
├── matchmaking/               # Matchmaking module (🔜 TODO)
│   ├── matchmaking.module.ts
│   ├── matchmaking.gateway.ts    # Socket.IO gateway
│   ├── matchmaking.service.ts
│   ├── queue.service.ts          # MMR queue logic
│   └── dto/
│       └── join-queue.dto.ts
│
├── battles/                   # Battles module (core game logic)
│   ├── battles.module.ts
│   ├── battles.gateway.ts        # Socket.IO gateway
│   ├── battles.service.ts
│   ├── battles.controller.ts     # REST endpoints for history
│   ├── game-state.service.ts     # In-memory battle state
│   ├── skills.service.ts         # Skill effects logic
│   ├── dto/
│   │   ├── submit-code.dto.ts
│   │   └── use-skill.dto.ts
│   └── entities/
│       ├── battle.entity.ts
│       └── battle-result.entity.ts
│
├── problems/                  # Problems module
│   ├── problems.module.ts
│   ├── problems.controller.ts
│   ├── problems.service.ts
│   ├── dto/
│   │   └── create-problem.dto.ts
│   └── entities/
│       ├── problem.entity.ts
│       └── test-case.entity.ts
│
├── code-execution/            # Judge0 integration
│   ├── code-execution.module.ts
│   ├── code-execution.service.ts
│   ├── judge0.client.ts          # Judge0 API client
│   └── dto/
│       └── execution-result.dto.ts
│
├── rankings/                  # Rankings module
│   ├── rankings.module.ts
│   ├── rankings.controller.ts
│   ├── rankings.service.ts
│   └── mmr.service.ts            # MMR calculation logic
│
└── prisma/                    # Prisma configuration
    ├── prisma.module.ts
    ├── prisma.service.ts
    └── schema.prisma
```

---

## Modules Overview

### Auth Module
- JWT token validation (tokens issued by Supabase)
- Guards for protected routes
- Current user extraction from token

### Users Module
- CRUD for user profiles
- Stats aggregation (wins, losses, MMR)
- Match history

### Clans Module
- Clan creation, joining, leaving
- Clan member management
- Clan war scheduling

### Matchmaking Module
**Socket.IO Gateway** handling:
- Queue join/leave
- MMR-based matching algorithm
- Battle royale lobby formation

```typescript
@WebSocketGateway()
export class MatchmakingGateway {
  @SubscribeMessage('matchmaking:join')
  handleJoinQueue(client: Socket, payload: JoinQueueDto) { }

  @SubscribeMessage('matchmaking:leave')
  handleLeaveQueue(client: Socket) { }
}
```

### Battles Module
**Core game logic** with Socket.IO Gateway:
- Real-time battle state management
- Code submission handling
- Skill activation and effects
- Winner determination

```typescript
@WebSocketGateway()
export class BattlesGateway {
  @SubscribeMessage('code:submit')
  handleCodeSubmit(client: Socket, payload: SubmitCodeDto) { }

  @SubscribeMessage('skill:use')
  handleSkillUse(client: Socket, payload: UseSkillDto) { }
}
```

### Problems Module
- Problem CRUD (admin only)
- Test case management
- Difficulty categorization
- Random problem selection for battles

### Code Execution Module
- Judge0 API integration
- Submission queueing
- Result polling
- Test case validation

### Rankings Module
- MMR calculation (Elo-based or Glicko-2)
- Leaderboard queries
- Rank tier assignment (Bronze, Silver, Gold, etc.)

### Subscriptions Module (Paywall)
Handles the freemium monetization model:
- Track daily free game usage per user
- Validate game access before matchmaking
- Stripe integration for payments
- Webhook handling for subscription events

```typescript
@Injectable()
export class SubscriptionsService {
  async canPlayGame(userId: string): Promise<boolean> { }
  async incrementGamesPlayed(userId: string): Promise<void> { }
  async resetDailyGames(): Promise<void> { } // Cron job
}
```

---

## Socket.IO Events

### Matchmaking Gateway

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `matchmaking:join` | C → S | `{ mode }` | Join queue |
| `matchmaking:leave` | C → S | — | Leave queue |
| `matchmaking:found` | S → C | `{ battleId, opponent }` | Match found |
| `matchmaking:status` | S → C | `{ position, estimatedWait }` | Queue status |

### Battles Gateway

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `battle:join` | C → S | `{ battleId }` | Join battle room |
| `battle:ready` | C → S | — | Player ready |
| `battle:start` | S → C | `{ problem, timeLimit }` | Battle starts |
| `battle:end` | S → C | `{ winner, stats }` | Battle ends |
| `code:submit` | C → S | `{ code, language }` | Submit solution |
| `code:result` | S → C | `{ passed, results }` | Execution result |
| `skill:use` | C → S | `{ skillId, targetId }` | Use skill |
| `skill:effect` | S → C | `{ skillId, duration }` | Skill applied |
| `opponent:progress` | S → C | `{ testsPassed }` | Live progress |

---

## Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  mmr           Int       @default(1000)
  wins          Int       @default(0)
  losses        Int       @default(0)
  clanId        String?
  clan          Clan?     @relation(fields: [clanId], references: [id])
  battles       BattleParticipant[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Clan {
  id            String    @id @default(uuid())
  name          String    @unique
  tag           String    @unique
  ownerId       String
  members       User[]
  createdAt     DateTime  @default(now())
}

model Problem {
  id            String    @id @default(uuid())
  title         String
  description   String
  difficulty    Difficulty
  starterCode   Json
  testCases     TestCase[]
  battles       Battle[]
  createdAt     DateTime  @default(now())
}

model TestCase {
  id            String    @id @default(uuid())
  problemId     String
  problem       Problem   @relation(fields: [problemId], references: [id])
  input         String
  expectedOutput String
  isHidden      Boolean   @default(false)
}

model Battle {
  id            String    @id @default(uuid())
  mode          BattleMode
  problemId     String
  problem       Problem   @relation(fields: [problemId], references: [id])
  participants  BattleParticipant[]
  winnerId      String?
  status        BattleStatus
  startedAt     DateTime?
  endedAt       DateTime?
  createdAt     DateTime  @default(now())
}

model BattleParticipant {
  id            String    @id @default(uuid())
  battleId      String
  battle        Battle    @relation(fields: [battleId], references: [id])
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  code          String?
  testsPassed   Int       @default(0)
  submittedAt   DateTime?
  mmrChange     Int?
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum BattleMode {
  ONE_V_ONE
  BATTLE_ROYALE
}

enum BattleStatus {
  WAITING
  IN_PROGRESS
  COMPLETED
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT (from Supabase)
JWT_SECRET=your-supabase-jwt-secret

# Judge0
JUDGE0_URL=http://localhost:2358
JUDGE0_API_KEY=optional-if-self-hosted

# App
PORT=3000
NODE_ENV=development
```

---

## Scripts

```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open Prisma Studio

# Testing
npm run test               # Unit tests
npm run test:e2e           # E2E tests
npm run test:cov           # Coverage report

# Linting
npm run lint
npm run format
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login (Supabase token exchange) |
| POST | `/auth/refresh` | Refresh token |
| GET | `/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:id` | Get user profile |
| PATCH | `/users/:id` | Update profile |
| GET | `/users/:id/history` | Match history |

### Clans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clans` | List clans |
| POST | `/clans` | Create clan |
| POST | `/clans/:id/join` | Join clan |
| POST | `/clans/:id/leave` | Leave clan |

### Problems (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/problems` | List problems |
| POST | `/problems` | Create problem |
| PUT | `/problems/:id` | Update problem |

### Rankings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rankings` | Global leaderboard |
| GET | `/rankings/clans` | Clan leaderboard |

---

## Skills System

| Skill | Effect | Duration | Cooldown |
|-------|--------|----------|----------|
| **Freeze** | Opponent can't type | 5s | 60s |
| **Scramble** | Randomize opponent's code characters | Instant | 90s |
| **Blind** | Hide opponent's test results | 15s | 120s |
| **Peek** | See opponent's current code | Instant | 45s |

Skills are managed in `battles/skills.service.ts` with cooldown tracking per player per battle.
