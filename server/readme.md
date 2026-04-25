# CodeQuest Battles — Server

**NestJS backend for the competitive coding battle platform**

[![Tests](https://img.shields.io/badge/tests-82%20passing-brightgreen)]()  
[![Coverage](https://img.shields.io/badge/coverage-excellent-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)]()

---

## 📚 Documentation

- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - What's built and what's not
- **[TODO.md](./TODO.md)** - Detailed task breakdown and next steps
- **Swagger API Docs** - http://localhost:3000/api/docs (when server is running)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL database** (or Supabase account)
- **Docker & Docker Compose** for Piston code execution engine

### 1. Environment Setup

Create a `.env` file in the `server/` directory:

```env
# ============================================
# DATABASE (REQUIRED)
# ============================================
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# ============================================
# JWT AUTHENTICATION (REQUIRED)
# ============================================
# Get this from your Supabase project settings
JWT_JWK='{"kty":"EC","crv":"P-256","x":"YOUR_X_VALUE","y":"YOUR_Y_VALUE"}'

# ============================================
# CODE EXECUTION - PISTON (REQUIRED)
# ============================================
# Local Piston instance (started with docker-compose)
PISTON_URL="http://localhost:2000"

# Note: Start Piston with: docker-compose up -d
# Piston provides secure sandboxed code execution for battles

# ============================================
# SERVER
# ============================================
PORT=3000
NODE_ENV=development
```

### 2. Installation

```bash
# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Push database schema (development)
npm run prisma:push

# Seed database with sample data
npm run prisma:seed
```

### 3. Start Piston Code Execution Engine

```bash
# Start Piston with Docker Compose
docker-compose up -d

# Verify Piston is running
curl http://localhost:2000/api/v2/runtimes

# View logs
docker-compose logs -f piston

# Stop Piston
docker-compose down
```

Piston will automatically install Python, Node.js, and TypeScript runtimes on first startup.

### 4. Run the Server

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### 5. Access the Application

- **API Base URL:** http://localhost:3000/api
- **Swagger Docs:** http://localhost:3000/api/docs
- **Prisma Studio:** `npm run prisma:studio`

---

## 🧪 Testing

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run integration tests (Piston)
npm run test:integration
```

### Test Results:
✅ **82 tests passing**

---

## ✍️ Authoring Problems

Problems live in YAML files under [`server/problems/`](./problems). Each file is the source of truth for one problem — the importer upserts it into the DB by stable `id`.

**Full authoring guide (v2 format, supported types, in-place mutation, adding a language):** [`server/problems/README.md`](./problems/README.md).

### Two formats at a glance

- **v2 (signature)** — recommended. Declare a typed function signature and structured `tests: [{ args, expected }]`. The server generates the IO harness. Zero stdin/stdout plumbing in the YAML.
- **v1 (harness)** — legacy. You write `prefix`/`body`/`suffix` plus raw stdin/stdout test cases by hand. Kept working, but do not use it for new problems.

The two are discriminated by the presence of a top-level `signature` block.

### v2 workflow

1. **Write the YAML.** Copy an existing file (e.g. [`problems/001-two-sum.yaml`](./problems/001-two-sum.yaml)) and edit. The schema lives in [`src/problems/authoring/problem-yaml.schema.ts`](./src/problems/authoring/problem-yaml.schema.ts).

    ```yaml
    id: problem-123-my-problem           # stable, lowercase, dashes only
    title: My Problem
    difficulty: EASY                     # EASY | MEDIUM | HARD
    tags: [arrays]
    description: |
      Markdown-formatted problem statement...
    signature:
      name: { javascript: solve, python: solve }
      params:
        - { name: n, type: int }
      returns: int
    starter:
      javascript: |
        function solve(n) {
          return 0;
        }
      python: |
        def solve(n):
            return 0
    tests:
      - { args: [1], expected: 0 }
      - { args: [5], expected: 4, hidden: true }
    ```

    Only the body of your function is shown in the editor; the server stitches a generated `prefix`/`suffix` around it before running Piston. Users can freely `console.log` / `print` to debug — output is captured separately from the answer via a `<<<CQ_ANSWER>>>` sentinel and routed to the Console tab, so debug output never breaks grading.

2. **Try it locally in the author preview UI.** Start server and client with the author flag:

    ```bash
    # server
    ENABLE_AUTHOR_TOOLS=true npm run start:dev

    # client
    npm run dev
    ```

    Open <http://localhost:5173/author> for the list, or jump straight to `/author/problems/<id>`. The `POST /api/author/dry-run` endpoint accepts both the v2 payload (`{signature, body, tests}`) and the legacy v1 payload (`{prefix, body, suffix, testCases}`). No DB writes happen during a dry-run. Without `ENABLE_AUTHOR_TOOLS=true` the endpoints 404.

3. **Import into the DB.** Once the dry-run looks good:

    ```bash
    npm run problems:import
    ```

    This parses every `server/problems/*.yaml`, Zod-validates it, and upserts the `Problem` + replaces its `TestCase` rows. Also runs automatically during `npm run prisma:seed`.

4. **Open a PR.** Commit the new YAML file. CI / deploy scripts should run `npm run problems:import` after migrations so prod stays in sync with the checked-in YAML files.

### Rules / gotchas

- IDs must be unique across all files. Duplicate IDs fail the importer loudly.
- Test cases are delete-and-created on every import — do not store anything else under the `TestCase` relation that you care about preserving.
- `hidden: true` test cases are not shown to solvers on failure.
- Supported languages today: `javascript`, `python`. See [`server/problems/README.md`](./problems/README.md#adding-a-new-language) for how to add a new one (it's a single template function in `harness-codegen.ts`; no YAML edits needed).
- For problems that mutate an argument in-place (e.g. Reverse String), set `signature.mutatesArg: <paramIndex>` and the generated suffix will grade the post-call value of that argument instead of the function's return.

---

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start dev server with hot reload |
| `npm run start:debug` | Start in debug mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate test coverage report |
| `npm run test:integration` | Run integration tests |
| `npm run lint` | Lint TypeScript files |
| `npm run format` | Format code with Prettier |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:push` | Push schema to database |
| `npm run prisma:migrate` | Run Prisma migrations |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:seed` | Seed database with sample data |
| `npm run problems:import` | Upsert every YAML problem under `server/problems/` |

---

## 🔐 Getting JWT_JWK from Supabase

### Method 1: From Project Settings
1. Go to your Supabase Dashboard
2. Navigate to **Project Settings** → **API**
3. Copy the **JWT Secret** (anon key)
4. Use it directly or convert to JWK format

### Method 2: Use the JWK Endpoint
Supabase provides a JWK endpoint at:
```
https://YOUR_PROJECT_ID.supabase.co/auth/v1/jwks
```

You can extract the JWK from there and add it to your `.env` file.

---

## 🗄️ Database Setup

### Using Supabase (Recommended)

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your database connection string from **Settings** → **Database**
3. Add it to `.env` as `DATABASE_URL`
4. Run `npm run prisma:push` to create tables
5. Run `npm run prisma:seed` to add sample data

### Using Local PostgreSQL

```bash
# Install PostgreSQL
# Create a database
createdb codequest_battles

# Update .env with connection string
DATABASE_URL="postgresql://localhost:5432/codequest_battles?schema=public"

# Push schema and seed
npm run prisma:push
npm run prisma:seed
```

### Database Schema

The database includes these tables:
- `User` - User accounts and profiles (MMR, wins, losses)
- `Clan` - Team/guild structure
- `Problem` - Coding challenges with test cases
- `TestCase` - Problem test cases (visible and hidden)
- `Battle` - Battle instances
- `BattleParticipant` - User participation in battles

See [schema.prisma](./prisma/schema.prisma) for full details.

---

## 📡 API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/sync` | Sync Supabase user to DB | ✅ JWT |
| GET | `/auth/me` | Get current user profile | ✅ JWT |

### Users (`/api/users`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | Get leaderboard (all users) | ❌ |
| GET | `/users/:id` | Get user by ID | ❌ |
| PATCH | `/users/:id` | Update user profile | ✅ JWT |

### Problems (`/api/problems`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/problems` | Create problem | ✅ Admin |
| GET | `/problems` | List all problems | ✅ JWT |
| GET | `/problems/random` | Get random problem | ✅ JWT |
| GET | `/problems/:id` | Get problem by ID | ✅ JWT |
| GET | `/problems/:id/testcases` | Get all test cases | ✅ Admin |
| PATCH | `/problems/:id` | Update problem | ✅ Admin |
| DELETE | `/problems/:id` | Delete problem | ✅ Admin |
| POST | `/problems/:id/execute` | Execute code | ✅ JWT |

### Battles (❌ Not Implemented Yet)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/battles` | Create battle | ✅ JWT |
| POST | `/battles/:id/join` | Join battle | ✅ JWT |
| POST | `/battles/:id/submit` | Submit solution | ✅ JWT |
| GET | `/battles/:id` | Get battle details | ✅ JWT |
| GET | `/battles/history` | Get user's battles | ✅ JWT |

See **[Swagger Docs](http://localhost:3000/api/docs)** for detailed schemas and examples.

---

## 💻 Code Execution

The server uses Piston for code execution:

### Piston Code Execution Engine ✅
- **Status:** Fully working
- **URL:** Local Docker instance at `http://localhost:2000`
- **Languages:** Python 3.12, Node.js 20, TypeScript 5, Java, C++, C, Rust
- **Tests:** ✅ All integration tests passing
- **Setup:** See `docker-compose.yml` for configuration

### Supported Languages
| Language | Version | Piston |
|----------|---------|--------|
| Python | 3.12.0 | ✅ |
| JavaScript | Node 20.11.1 | ✅ |
| TypeScript | 5.0.3 | ✅ |
| Java | 17+ | ✅ |
| C++ | GCC 11+ | ✅ |
| C | GCC 11+ | ✅ |
| Rust | 1.70+ | ✅ |

---and ran tests

## 📊 Sample Data

After running `npm run prisma:seed`, you'll have:

### Users (3)
- **Admin** - `admin@codequest.dev` (role: admin, MMR: 1500)
- **Alice** - `alice@example.com` (MMR: 1200)
- **Bob** - `bob@example.com` (MMR: 1000)

### Problems (7)
1. **Two Sum** (Easy) - Array problem
2. **Reverse String** (Easy) - String manipulation
3. **FizzBuzz** (Medium) - Classic interview problem
4. **Palindrome Checker** (Medium) - String validation
5. **Valid Parentheses** (Medium) - Stack problem
6. **Merge Sort** (Hard) - Sorting algorithm
7. **Binary Search Tree** (Hard) - Data structure

Each problem includes:
- Multi-language starter code
- Visible test cases (for user feedback)
- Hidden test cases (for final validation)

---

## 🏗️ Project Structure

```
server/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── seed.ts                 # Sample data seeder
├── src/
│   ├── auth/                   # ✅ Authentication (JWT, user sync)
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   ├── dto/
│   │   └── strategies/
│   ├── users/                  # ✅ User management & leaderboard
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   ├── problems/               # ✅ Problem CRUD & code execution
│   │   ├── problems.controller.ts
│   │   ├── problems.service.ts
│   │   ├── problems.module.ts
│   │   └── dto/
│   ├── code-execution/         # ✅ Piston code execution
│   │   ├── code-execution.service.ts
│   │   ├── piston.client.ts
│   │   └── *.spec.ts (tests)
│   ├── prisma/                 # ✅ Prisma service
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── common/                 # ✅ Guards, decorators, utilities
│   │   ├── decorators/
│   │   └── guards/
│   ├── app.module.ts           # Main app module
│   └── main.ts                 # Bootstrap & Swagger setup
├── test/                       # E2E tests (TODO)
├── .env                        # Environment variables (create this)
├── package.json
├── jest.config.js
├── tsconfig.json
├── nest-cli.json
├── README.md                   # This file
├── IMPLEMENTATION_STATUS.md    # Feature status & test results
└── TODO.md                     # Detailed task breakdown
```

---

## 🎯 What's Implemented

### ✅ Completed (57 tests passing)
1. **Authentication** - JWT via Supabase, user sync, role-based access
2. **User Management** - CRUD operations, profiles, leaderboard
3. **Problems** - CRUD, test cases, pagination, filtering, random selection
4. **Code Execution** - Piston integration, multi-language support, test validation

### 🚧 In Progress
_Nothing currently in progress_

### ❌ Not Started
1. **Battle System** - Real-time 1v1 competitions (database ready)
2. **WebSockets** - Live updates for battles
3. **Matchmaking** - MMR-based player matching
4. **Clan System** - Team/guild functionality (database ready)
5. **Advanced Rankings** - Time-based leaderboards, rank tiers

See **[TODO.md](./TODO.md)** for detailed implementation plan.

---

## 🧑‍💻 Development Guidelines

### TypeScript Rules (STRICTLY ENFORCED)

1. **NEVER use `any` type** - Use proper types or `unknown`
2. **Always type function parameters** - Every param needs a type
3. **Always type return values** - Explicit return types required
4. **Use DTOs for all API inputs** - Validate with class-validator
5. **Prefer interfaces over types** - For object shapes

```typescript
// ❌ BAD
async handleRequest(req, payload) {
  // ...
}

// ✅ GOOD
async handleRequest(
  req: Request, 
  payload: CreateUserDto
): Promise<UserResponseDto> {
  // ...
}
```

### Testing Requirements

- Write tests for all new features
- Aim for >80% code coverage
- Mock external dependencies (Prisma, Piston)
- Use integration tests for critical flows

### Code Style

- Use Prettier for formatting: `npm run format`
- Use ESLint for linting: `npm run lint`
- Follow NestJS conventions
- Keep controllers thin, services fat

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test database connection
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npm run prisma:push -- --force-reset
```

### Code Execution Not Working
```bash
# Start Piston via Docker Compose
cd server && docker-compose up -d

# Check Piston container status
docker ps --filter "name=piston"

# Check Piston health
curl http://localhost:2000/api/v2/runtimes
```

### JWT Authentication Failing
- Make sure `JWT_JWK` is correctly formatted in `.env`
- Verify Supabase JWT token is valid (check expiration)
- Test with Swagger UI - it has a built-in auth form

### Tests Failing
```bash
# Clear Jest cache
npm test -- --clearCache

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- auth.service.spec.ts
```

---

## 📈 Performance Tips

- Use pagination for large lists (already implemented in `/api/problems` and `/api/users`)
- Index frequently queried fields in Prisma schema (already done for email, username)
- Use connection pooling for production (configure in `DATABASE_URL`)
- Cache problem data (implement Redis for production)

---

## 🚢 Deployment

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_JWK='{"kty":"EC",...}'
PORT=3000
```

### Build & Run
```bash
npm run build
npm run start:prod
```

### Docker (TODO)
Docker support coming soon!

---

## 📝 License

This project is for educational purposes.

---

## 🤝 Contributing

See **[TODO.md](./TODO.md)** for areas that need work!

Key priorities:
1. Battle System (HIGH)
2. WebSockets (HIGH)
3. Matchmaking (HIGH)
4. Clan System (MEDIUM)

---

**Built with NestJS, TypeScript, Prisma, and ❤️**
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
│   └── piston.client.ts
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
├── code-execution/            # Piston integration
│   ├── code-execution.module.ts
│   ├── code-execution.service.ts
│   ├── piston.client.ts          # Piston API client
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
- Piston API integration
- Multi-language code execution
- Test case validation
- Error handling and timeouts

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

# Piston Code Execution
PISTON_URL=http://localhost:2000

# App
PORT=3000
NODE_ENV=development
```

---

## Supabase Storage (Avatars)

User-uploaded profile pictures are stored in a public Supabase Storage
bucket called `avatars`. The client uploads directly from the browser and
then calls `PATCH /auth/avatar` with the resulting public URL. Provider
avatars (GitHub/Google) are captured automatically during `POST /auth/sync`
and do not require the bucket.

One-time setup in the Supabase dashboard:

1. **Storage → New bucket** → name `avatars`, Public bucket **on**.
2. Add the RLS policies below so each user can manage only their own folder
   (`<user-id>/...`):

   ```sql
   -- Anyone can read (bucket is public, but being explicit keeps RLS on):
   create policy "avatars public read"
     on storage.objects for select
     using (bucket_id = 'avatars');

   -- Authenticated users may upload only under their own folder:
   create policy "avatars owner upload"
     on storage.objects for insert to authenticated
     with check (
       bucket_id = 'avatars'
       and (storage.foldername(name))[1] = auth.uid()::text
     );

   -- Same restriction for updates and deletes:
   create policy "avatars owner modify"
     on storage.objects for update to authenticated
     using (
       bucket_id = 'avatars'
       and (storage.foldername(name))[1] = auth.uid()::text
     );
   create policy "avatars owner delete"
     on storage.objects for delete to authenticated
     using (
       bucket_id = 'avatars'
       and (storage.foldername(name))[1] = auth.uid()::text
     );
   ```

The client helper [`client/src/services/avatar.ts`](../client/src/services/avatar.ts)
enforces a 5MB cap and accepts PNG, JPEG, WEBP, and GIF.

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
