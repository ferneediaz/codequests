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
  - [x] Judge0 API integration (optional)
  - [x] Multi-language support (Python, JS, TS, Java, C++, C, Rust)
  - [x] Test case validation
  - [x] Error handling
  - [x] All tests passing ✅

---

## 🚧 In Progress

_Nothing currently in progress_

---

## 📋 TODO - Battle System (HIGH PRIORITY)

This is the **core competitive feature**. The database schema is ready, but implementation is needed.

### Task Breakdown:

#### 1. Battle Module & Service
- [ ] Create `battles/` module with NestJS CLI
- [ ] Implement `BattlesService`
  - [ ] `createBattle(userId, problemId, mode)` - Initialize battle
  - [ ] `joinBattle(userId, battleId)` - Join existing battle
  - [ ] `submitSolution(battleId, userId, code, language)` - Submit code
  - [ ] `completeBattle(battleId)` - Calculate winner & update MMR
  - [ ] `getBattleHistory(userId)` - Get user's past battles
  - [ ] `getBattleDetails(battleId)` - Get battle info
- [ ] Write unit tests for all service methods
- [ ] **Success Criteria:** All service tests passing ✅

#### 2. Battle Controller & APIs
- [ ] Create REST endpoints:
  - [ ] `POST /api/battles` - Create new battle
  - [ ] `POST /api/battles/:id/join` - Join battle
  - [ ] `POST /api/battles/:id/submit` - Submit solution
  - [ ] `GET /api/battles/:id` - Get battle details
  - [ ] `GET /api/battles/history` - Get user's battle history
- [ ] Add Swagger documentation
- [ ] Add authentication guards
- [ ] Write integration tests
- [ ] **Success Criteria:** All API tests passing ✅

#### 3. MMR Calculation System
- [ ] Implement Elo/MMR rating algorithm
- [ ] Handle MMR updates for winners/losers
- [ ] Add win/loss counters update
- [ ] Test edge cases (draws, timeouts)
- [ ] **Success Criteria:** MMR calculations verified ✅

#### 4. Battle Logic
- [ ] Determine winner logic:
  - [ ] Most test cases passed
  - [ ] Fastest submission time (tiebreaker)
  - [ ] Handle edge cases (both fail, timeout)
- [ ] Status transitions (WAITING → IN_PROGRESS → COMPLETED)
- [ ] Timeout handling (auto-complete if time limit reached)
- [ ] **Success Criteria:** Winner determination tests passing ✅

---

## 📋 TODO - Real-time Features (HIGH PRIORITY)

Required for live battles.

### Task Breakdown:

#### 1. WebSocket Gateway Setup
- [ ] Create `websockets/` module
- [ ] Set up Socket.IO gateway
- [ ] Implement connection authentication (from JWT)
- [ ] Add error handling
- [ ] **Success Criteria:** WebSocket connections working ✅

#### 2. Battle Room Management
- [ ] Create room join/leave logic
- [ ] Broadcast battle state updates to room
- [ ] Handle disconnections gracefully
- [ ] Implement reconnection logic
- [ ] **Success Criteria:** Room management tests passing ✅

#### 3. Real-time Events
- [ ] `battle.created` - Notify when battle is created
- [ ] `battle.player_joined` - Player joins battle
- [ ] `battle.started` - Battle begins
- [ ] `battle.submission` - Player submits code
- [ ] `battle.completed` - Battle ends with results
- [ ] `battle.status_update` - Any status change
- [ ] **Success Criteria:** All events firing correctly ✅

#### 4. Integration with Battle Service
- [ ] Connect WebSocket events to BattlesService
- [ ] Real-time code execution updates
- [ ] Live test case results
- [ ] **Success Criteria:** Full integration tests passing ✅

---

## 📋 TODO - Matchmaking System (HIGH PRIORITY)

Connect players for battles.

### Task Breakdown:

#### 1. Queue Management
- [ ] Create `matchmaking/` module
- [ ] Implement in-memory queue (or Redis for production)
- [ ] `joinQueue(userId, difficulty?, mode?)` - Enter matchmaking
- [ ] `leaveQueue(userId)` - Leave queue
- [ ] Handle queue timeouts
- [ ] **Success Criteria:** Queue operations working ✅

#### 2. Matching Algorithm
- [ ] Implement MMR-based matching (±100 MMR range)
- [ ] Expand range over time if no match found
- [ ] Match by preferred difficulty
- [ ] Quick match vs. Ranked match modes
- [ ] **Success Criteria:** Players matched correctly ✅

#### 3. Queue API
- [ ] `POST /api/matchmaking/queue` - Join queue
- [ ] `DELETE /api/matchmaking/queue` - Leave queue
- [ ] `GET /api/matchmaking/status` - Check queue status
- [ ] WebSocket events for match found
- [ ] **Success Criteria:** API tests passing ✅

#### 4. Integration
- [ ] Auto-create battle when match found
- [ ] Notify both players via WebSocket
- [ ] Redirect players to battle room
- [ ] **Success Criteria:** End-to-end matchmaking flow works ✅

---

## 📋 TODO - Clan System (MEDIUM PRIORITY)

Team/guild functionality.

### Task Breakdown:

#### 1. Clan Module & Service
- [ ] Create `clans/` module
- [ ] Implement `ClansService`
  - [ ] `createClan(ownerId, name, tag)` - Create new clan
  - [ ] `invitePlayer(clanId, userId)` - Invite member
  - [ ] `joinClan(userId, clanId, inviteCode?)` - Join clan
  - [ ] `leaveClan(userId)` - Leave clan
  - [ ] `getClanDetails(clanId)` - Get clan info
  - [ ] `getClanMembers(clanId)` - List members
  - [ ] `disbandClan(clanId, ownerId)` - Delete clan
- [ ] **Success Criteria:** All service tests passing ✅

#### 2. Clan APIs
- [ ] `POST /api/clans` - Create clan
- [ ] `GET /api/clans/:id` - Get clan details
- [ ] `GET /api/clans/:id/members` - List members
- [ ] `POST /api/clans/:id/join` - Join clan
- [ ] `POST /api/clans/:id/invite` - Invite player
- [ ] `DELETE /api/clans/:id/leave` - Leave clan
- [ ] `DELETE /api/clans/:id` - Disband clan (owner only)
- [ ] **Success Criteria:** All API tests passing ✅

#### 3. Clan Stats & Leaderboard
- [ ] Aggregate clan stats (total wins, losses, avg MMR)
- [ ] Clan level/progression system (optional)
- [ ] Clan leaderboard API
- [ ] **Success Criteria:** Stats calculated correctly ✅

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
- [ ] Auth: All tests passing ✅ (DONE)
- [ ] Users: All tests passing ✅ (DONE)
- [ ] Problems: All tests passing ✅ (DONE)
- [ ] Code Execution: All tests passing ✅ (DONE)
- [ ] **Battles: All tests passing** ⏳ (TODO)
- [ ] **WebSockets: All tests passing** ⏳ (TODO)
- [ ] **Matchmaking: All tests passing** ⏳ (TODO)
- [ ] **Clans: All tests passing** ⏳ (TODO)
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
- [ ] Add Judge0 services (if using)
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
- [ ] Judge0 integration tests always skipped (could make it configurable)

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
