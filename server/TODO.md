# CodeQuest Battles - TODO List

**Status:** This is a big feature. Success is marked only when ALL test cases pass.

---

## ✅ Completed

### Phase 1: Foundation ✅
- [x] **Auth System** - JWT authentication with Supabase
  - [x] User sync endpoint
  - [x] JWT strategy & guards
  - [x] Role-based access control
  - [x] All tests passing ✅
  
- [x] **User Management** - User profiles and leaderboard
  - [x] User CRUD operations
  - [x] Leaderboard API
  - [x] Profile updates
  - [x] All tests passing ✅

- [x] **Problems System** - Coding challenge management
  - [x] Problem CRUD (admin only)
  - [x] Multi-language starter code support
  - [x] Test case management (visible & hidden)
  - [x] Pagination & filtering
  - [x] Random problem selection
  - [x] All tests passing ✅

- [x] **Code Execution** - Run and validate user code
  - [x] Piston API integration
  - [x] Multi-language support (Python, JS, TS, Java, C++, C, Rust)
  - [x] Test case validation
  - [x] Error handling
  - [x] All tests passing ✅

---

## 🚧 In Progress

_Nothing currently in progress_

---

## ✅ Battle System - COMPLETED

The **core competitive feature** is now implemented!

### Completed:

#### 1. Battle Module & Service ✅
- [x] Create `battles/` module with NestJS CLI
- [x] Implement `BattlesService`
  - [x] `createBattle(userId, dto)` - Initialize battle
  - [x] `joinBattle(userId, battleId)` - Join existing battle
  - [x] `submitSolution(battleId, userId, code, language)` - Submit code
  - [x] `completeBattle(battleId)` - Calculate winner & update MMR
  - [x] `getBattleHistory(userId)` - Get user's past battles
  - [x] `getBattleDetails(battleId)` - Get battle info
  - [x] `getAvailableBattles(userId)` - Get waiting battles
- [x] Unit tests for all service methods (25 tests passing)

#### 2. Battle Controller & APIs ✅
- [x] REST endpoints:
  - [x] `POST /api/battles` - Create new battle
  - [x] `POST /api/battles/:id/join` - Join battle
  - [x] `POST /api/battles/:id/submit` - Submit solution
  - [x] `GET /api/battles/:id` - Get battle details
  - [x] `GET /api/battles/history` - Get user's battle history
  - [x] `GET /api/battles/available` - Get available battles
- [x] Swagger documentation
- [x] Authentication guards

#### 3. MMR Calculation System ✅
- [x] Elo-based MMR rating algorithm
- [x] MMR updates for winners/losers (K-factor = 32)
- [x] Win/loss counters update

#### 4. Battle Logic ✅
- [x] Winner determination:
  - [x] Most test cases passed
  - [x] Fastest submission time (tiebreaker)
- [x] Status transitions (WAITING → IN_PROGRESS → COMPLETED)

---

## ✅ Team/Clan Battle System - COMPLETED

Extended battle system with team modes!

### Completed:

#### 1. Clan Module ✅
- [x] `ClansService` with full CRUD operations
  - [x] `create(ownerId, name, tag)` - Create new clan
  - [x] `findAll()` - List all clans
  - [x] `findOne(id)` - Get clan details
  - [x] `join(userId, clanId)` - Join clan
  - [x] `leave(userId)` - Leave clan
  - [x] `kick(clanId, memberId, requesterId)` - Kick member
  - [x] `delete(clanId, requesterId)` - Delete clan
  - [x] `updateMmr(clanId, mmrChange)` - Update clan MMR
- [x] REST endpoints with Swagger docs
- [x] Seed data (MIT Hackers, Harvard Coders)

#### 2. Team Battle Modes ✅
- [x] `CLAN_VS_CLAN` mode - Clan vs clan battles
- [x] `GROUP` mode - Ad-hoc team battles with auto-balance
- [x] Team sizes: 2, 3, or 5 players per team
- [x] Time limits up to 120 minutes

#### 3. Problem Pool System ✅
- [x] `ProblemPool` model for team battles
- [x] Multiple problems per battle
- [x] Point scoring: Easy=2, Medium=5, Hard=10

#### 4. Team Assignment Logic ✅
- [x] CLAN_VS_CLAN: Assign by clan membership
- [x] GROUP: Auto-balance by MMR
- [x] Manual team selection option
- [x] Clan validation for clan battles

#### 5. Clan MMR System ✅
- [x] Separate clan MMR from individual MMR
- [x] ±15 MMR change per clan battle
- [x] Winner/loser clan MMR updates

#### 6. Tests ✅
- [x] CLAN_VS_CLAN mode tests (3 tests)
- [x] GROUP mode tests (2 tests)
- [x] All 30 battles.service.spec.ts tests passing

---

## ✅ Real-time Features - WebSocket Gateway COMPLETED

Real-time battle functionality is now implemented!

### Completed:

#### 1. WebSocket Gateway Setup ✅
- [x] Create `websockets/` module
- [x] Set up Socket.IO gateway (BattlesGateway)
- [x] Implement connection authentication (JWT token validation)
- [x] Add error handling
- [x] **24 tests passing** ✅

#### 2. Battle Room Management ✅
- [x] Create room join/leave logic (`joinBattleRoom`, `leaveBattleRoom`)
- [x] Broadcast battle state updates to room
- [x] Handle disconnections gracefully (cleanup client tracking)
- [x] Implement reconnection logic (auto-rejoin active battles)
- [x] **All room management tests passing** ✅

#### 3. Real-time Events ✅
- [x] `battle.started` - Battle begins
- [x] `battle.submission` - Player submits code
- [x] `battle.completed` - Battle ends with results
- [x] `battle.status_update` - Any status change
- [x] **All event emission tests passing** ✅

#### 4. Client Tracking ✅
- [x] Track connected clients with user mapping
- [x] `getConnectedClients()` - Get all connected clients
- [x] `getSocketByUserId()` - Find socket by user ID
- [x] Proper cleanup on disconnect

---

## ✅ WsAuthGuard Implementation - COMPLETED

WebSocket authentication guard is now fully implemented!

### Completed:

#### 1. WsAuthGuard Tests & Implementation ✅
- [x] Write tests for `WsAuthGuard` (8 tests passing)
- [x] Implement JWT validation in guard via `JwtVerificationService`
- [x] Integrate with existing auth system (`AuthModule` export)
- [x] Apply `@UseGuards(WsAuthGuard)` to message handlers
- [x] **Success Criteria:** All guard tests passing ✅

#### 2. Register WebsocketsModule ✅
- [x] Import `AuthModule` in `WebsocketsModule`
- [x] Add `JwtVerificationService` to `AuthModule` providers & exports
- [x] Replace stub token parsing in gateway with real JWT verification
- [x] Consistent user data attachment across guard and gateway
- [x] All 33 websocket tests passing ✅

---

## ✅ Matchmaking System - COMPLETED

Connect players for battles automatically.

### Completed:

#### 1. Queue Management ✅
- [x] Create `matchmaking/` module
- [x] `joinQueue(userId, difficulty?, mode?)` - Enter matchmaking
- [x] `leaveQueue(userId)` - Leave queue
- [x] Handle queue timeouts (10 min expiry via scheduled task)
- [x] Prevent double-queuing and queue-while-in-battle
- [x] **Success Criteria:** Queue operations working ✅

#### 2. Matching Algorithm ✅
- [x] Implement MMR-based matching (±100 MMR base range)
- [x] Expand range over time if no match found (+50 per 30s)
- [x] MMR range cap at 500 to prevent unfair matches
- [x] Match by preferred difficulty
- [x] Periodic queue processing every 5 seconds
- [x] **Success Criteria:** Players matched correctly ✅

#### 3. Queue API ✅
- [x] `POST /api/matchmaking/queue` - Join queue
- [x] `DELETE /api/matchmaking/queue` - Leave queue
- [x] `GET /api/matchmaking/status` - Check queue status
- [x] Swagger documentation
- [x] Authentication guards
- [x] **Success Criteria:** API working ✅

#### 4. Integration ✅
- [x] Auto-create battle when match found
- [x] Notify both players via WebSocket (`matchmaking.match_found`)
- [x] Error recovery: revert entries to QUEUED if battle creation fails
- [x] Clean up matchmaking entries after successful battle creation
- [x] **Success Criteria:** End-to-end matchmaking flow works ✅

#### 5. Tests ✅
- [x] All 40 tests passing
- [x] Queue join/leave/status tests
- [x] MMR range calculation tests (including cap)
- [x] Match finding & battle creation tests
- [x] WebSocket notification tests
- [x] Error recovery tests
- [x] Background queue processing tests

---

## ✅ Clan System - COMPLETED

Team/guild functionality is now implemented!

### Completed:

#### 1. Clan Module & Service ✅
- [x] Create `clans/` module
- [x] Implement `ClansService`
  - [x] `create(ownerId, name, tag)` - Create new clan
  - [x] `findAll()` - List all clans
  - [x] `findOne(clanId)` - Get clan details
  - [x] `join(userId, clanId)` - Join clan
  - [x] `leave(userId)` - Leave clan
  - [x] `kick(clanId, memberId, requesterId)` - Kick member
  - [x] `delete(clanId, ownerId)` - Delete clan

#### 2. Clan APIs ✅
- [x] `POST /api/clans` - Create clan
- [x] `GET /api/clans` - List all clans
- [x] `GET /api/clans/:id` - Get clan details
- [x] `POST /api/clans/:id/join` - Join clan
- [x] `POST /api/clans/leave` - Leave clan
- [x] `DELETE /api/clans/:id/members/:memberId` - Kick member
- [x] `DELETE /api/clans/:id` - Delete clan (owner only)
- [x] Swagger documentation

#### 3. Clan Battle Integration ✅
- [x] Clan MMR system
- [x] CLAN_VS_CLAN battle mode
- [x] Clan validation in battles

### Remaining (Enhancement):
- [ ] Clan invite system (invite codes)
- [ ] Clan leaderboard API
- [ ] Clan level/progression system

---

## 📋 TODO - Advanced Rankings (LOW PRIORITY)

Enhanced leaderboard features.

### Task Breakdown:

#### 1. Rank Tiers
- [ ] Define rank tiers (Bronze, Silver, Gold, Platinum, Diamond, Master)
- [ ] Calculate tier based on MMR ranges
- [ ] Add tier to user response DTO
- [ ] **Success Criteria:** Tiers assigned correctly ✅

#### 2. Time-based Rankings
- [ ] Daily leaderboard
- [ ] Weekly leaderboard
- [ ] Monthly leaderboard
- [ ] All-time leaderboard (already exists)
- [ ] **Success Criteria:** Time-based queries working ✅

#### 3. Ranking APIs
- [ ] `GET /api/rankings/global?period=daily|weekly|monthly|alltime`
- [ ] `GET /api/rankings/clans`
- [ ] **Success Criteria:** API tests passing ✅

---

## 🧪 Testing Requirements

**IMPORTANT:** This is a big feature. Mark as SUCCESS only when ALL tests pass.

### Test Coverage Goals:
- [x] Auth: All tests passing ✅ (7 tests)
- [x] Users: All tests passing ✅ (15 tests)
- [x] Problems: All tests passing ✅ (14 tests)
- [x] Code Execution: All tests passing ✅ (9 unit + 17 integration)
- [x] **Battles: All tests passing ✅ (32 tests)**
- [x] **WebSockets: All tests passing ✅ (24 tests)**
- [x] **Matchmaking: All tests passing ✅ (26 tests)**
- [x] **WsAuthGuard: All tests passing ✅ (8 tests)**
- [x] **Clans: Module implemented** ✅ (tests in battles.service.spec)
- [ ] **E2E Tests: Full flow working** ⏳ (TODO)

### E2E Test Scenarios:
- [ ] User signs up → syncs to DB → appears on leaderboard
- [ ] User joins queue → gets matched → battle created → submit code → winner determined → MMR updated
- [ ] Clan created → members join → clan stats updated
- [ ] Problem created (admin) → user solves it → execution works

---

## 📦 Infrastructure TODOs

### Docker Compose Setup (Optional)
- [ ] Add PostgreSQL service
- [ ] Add Redis for queue management
- [ ] Production-ready docker-compose.yml

### Environment & Config
- [ ] Document all environment variables
- [ ] Add .env.example file
- [ ] Validate environment on startup
- [ ] Add health check endpoints

### Deployment
- [ ] Production build optimization
- [ ] Database migrations strategy
- [ ] CI/CD pipeline setup
- [ ] Monitoring & logging setup

---

## 🐛 Known Issues & Tech Debt

### Current Issues:
- [ ] JWT validation could be more robust (add token expiration checks)
- [ ] Error messages could be more user-friendly
- [ ] No rate limiting on APIs
- [ ] No request logging/monitoring

### Tech Debt:
- [ ] jest.config.js shows deprecation warnings (ts-jest globals config)
- [ ] Some test output is verbose (could silence non-critical logs)

---

## 📝 Documentation TODOs

- [x] Implementation status document (DONE - IMPLEMENTATION_STATUS.md)
- [x] TODO list (DONE - this file)
- [ ] API documentation improvements
  - [ ] Add usage examples
  - [ ] Add authentication flow guide
  - [ ] Add error code reference
- [ ] Architecture documentation
  - [ ] System design diagrams
  - [ ] Database ER diagram
  - [ ] WebSocket event flow
- [ ] Developer onboarding guide
  - [ ] Local setup instructions
  - [ ] Testing guide
  - [ ] Contributing guidelines

---

## 🎯 Success Criteria (Overall)

### Phase 1: Foundation ✅ COMPLETE
- [x] Auth, Users, Problems, Code Execution all implemented
- [x] All tests passing (57/57)
- [x] API documentation complete

### Phase 2: Core Competition (IN PROGRESS)
- [ ] Battles system fully working
- [ ] Real-time updates via WebSockets
- [ ] Matchmaking functional
- [ ] MMR system working
- [ ] **All tests passing** (this is the requirement!)

### Phase 3: Social Features
- [ ] Clan system working
- [ ] Clan battles/tournaments
- [ ] Advanced rankings

### Phase 4: Production Ready
- [ ] E2E tests passing
- [ ] Performance optimized
- [ ] Security hardened
- [ ] Monitoring in place
- [ ] Deployed to production

---

## 📅 Timeline (Estimated)

| Phase | Estimated Time | Priority |
|-------|---------------|----------|
| Battle System | 3-5 days | HIGH |
| WebSockets | 2-3 days | HIGH |
| Matchmaking | 2-3 days | HIGH |
| Clans | 2-3 days | MEDIUM |
| Advanced Rankings | 1-2 days | LOW |
| Testing & Bug Fixes | 2-3 days | HIGH |
| Documentation | 1-2 days | MEDIUM |
| **Total** | **13-21 days** | - |

---

## 💡 Notes

- Focus on getting battles working first - it's the core feature
- WebSockets are critical for good UX in battles
- Matchmaking can start simple (FIFO queue) and be improved later
- Clans can wait until battles are solid
- Keep writing tests as you go - don't save them for the end!

---

**Remember:** This feature is only considered successful when ALL test cases pass! ✅
