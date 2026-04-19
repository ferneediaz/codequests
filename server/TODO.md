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

#### 3. MMR Calculation System ✅ (base implementation)
- [x] Elo-based MMR rating algorithm
- [x] MMR updates for winners/losers (K-factor = 32)
- [x] Win/loss counters update
- [ ] **⚠️ NEEDS UPDATE:** Scale MMR by problem count (see "MMR Scaling System" section below)

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
- [ ] Clan challenge system (see below)

---

## 📋 TODO - Subscription & Stripe Module (HIGH PRIORITY)

Payment system — required for frontend monetization.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `Subscription` model (id, userId, plan, stripeCustomerId, stripeSubscriptionId, status, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt)
- [ ] Add `gamesPlayedToday` and `lastGameResetAt` fields to User model
- [ ] Add `subscriptionId` relation to User model
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles, migration runs clean ✅

#### 2. Subscription Service
- [ ] Create `subscriptions/` module with NestJS CLI
- [ ] `createCheckoutSession(userId)` — Create Stripe hosted checkout session, redirect URL
- [ ] `handleWebhook(event)` — Process Stripe webhook events (checkout.session.completed, invoice.paid, customer.subscription.deleted, customer.subscription.updated)
- [ ] `getSubscriptionStatus(userId)` — Return plan, gamesRemaining, resetsAt
- [ ] `canPlay(userId)` — Check if user can start a game (pro OR gamesPlayedToday < 1)
- [ ] `incrementDailyGameCount(userId)` — Called when a battle starts
- [ ] `resetDailyGameCounts()` — Scheduled task at midnight UTC
- [ ] Stripe customer creation on first checkout
- [ ] **Success Criteria:** Full subscription lifecycle works ✅

#### 3. Subscription API
- [ ] `POST /api/subscriptions/checkout` — Create Stripe checkout session (returns redirect URL)
- [ ] `POST /api/subscriptions/webhook` — Stripe webhook endpoint (raw body, signature verification)
- [ ] `GET /api/subscriptions/status` — Get current user's subscription status
- [ ] `POST /api/subscriptions/portal` — Create Stripe customer portal session (manage/cancel sub)
- [ ] Swagger documentation
- [ ] Authentication guards (except webhook)
- [ ] **Success Criteria:** API tests passing ✅

#### 4. Integration with Battles
- [ ] Add `canPlay()` check in `BattlesService.createBattle()` and `joinBattle()`
- [ ] Add `incrementDailyGameCount()` call when battle starts
- [ ] Free users: stats/history NOT saved (skip MMR update, skip history write)
- [ ] Invited free users: can play but no stats persistence
- [ ] **Success Criteria:** Free users gated after 1 game/day ✅

#### 5. Pricing
- [ ] $5 per 2 months subscription
- [ ] Single plan (no tiers)
- [ ] **Success Criteria:** Stripe checkout works end-to-end ✅

#### 6. Tests
- [ ] Checkout session creation tests
- [ ] Webhook handling tests (all event types)
- [ ] canPlay() logic tests (free vs pro, daily counter, reset)
- [ ] Battle integration tests (gating, stats persistence)
- [ ] **Success Criteria:** All subscription tests passing ✅

---

## 📋 TODO - Skills System (HIGH PRIORITY)

In-battle power-ups — toggleable per game, each usable once per battle.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `SkillType` enum: `FREEZE`, `SCRAMBLE`, `BLIND`, `TIME_STEAL`, `FOG_OF_WAR`
- [ ] Add `enabledSkills` field to Battle model (JSON array of SkillType, default: [])
- [ ] Add `BattleSkillUse` model (id, battleId, userId, targetUserId, skillType, usedAt)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles, migration runs clean ✅

#### 2. Skill Definitions
| Skill | Effect | Duration |
|-------|--------|----------|
| `FREEZE` | Lock opponent's editor | 10 seconds |
| `SCRAMBLE` | Shuffle opponent's code lines | Instant |
| `BLIND` | Hide opponent's test case results | Until next submission |
| `TIME_STEAL` | Reduce opponent's remaining time | -60 seconds |
| `FOG_OF_WAR` | Blur opponent's screen | 20 seconds |

#### 3. Skills Service
- [ ] `useSkill(battleId, userId, targetUserId, skillType)` — Validate & record skill use
- [ ] Validation: skill is enabled for this battle
- [ ] Validation: user hasn't already used this skill in this battle (single-use)
- [ ] Validation: battle is IN_PROGRESS
- [ ] Validation: target is a participant in the battle
- [ ] Validation: user is not targeting themselves
- [ ] **Success Criteria:** All validations working ✅

#### 4. WebSocket Events
- [ ] `skill.use` (client → server) — `{ battleId, targetUserId, skillType }`
- [ ] `skill.effect` (server → client) — `{ skillType, fromUserId, duration }` (sent to target)
- [ ] `skill.used` (server → room) — `{ userId, skillType, targetUserId }` (broadcast to room)
- [ ] Add skill events to `BattlesGateway`
- [ ] **Success Criteria:** Skill events emit correctly ✅

#### 5. Battle Creation Integration
- [ ] Add `enabledSkills` to `CreateBattleDto` (optional array of SkillType)
- [ ] Store enabled skills on battle creation
- [ ] **Success Criteria:** Skills config stored on battle ✅

#### 6. Tests
- [ ] Skill use validation tests (enabled check, single-use, in-progress check)
- [ ] WebSocket skill event tests
- [ ] Battle creation with skills tests
- [ ] **Success Criteria:** All skill tests passing ✅

---

## 📋 TODO - Direct Invite System (HIGH PRIORITY)

Allow players to invite each other to games via link or username.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `inviteCode` field to Battle model (unique, nullable, 8-char alphanumeric)
- [ ] Add index on `inviteCode`
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Invite Service
- [ ] `generateInviteCode()` — Generate unique 8-char code
- [ ] `createBattleWithInvite(userId, dto)` — Create battle with invite code
- [ ] `joinByInviteCode(userId, code)` — Join battle via invite code
- [ ] `getByInviteCode(code)` — Get battle details from invite code
- [ ] **Success Criteria:** Invite codes work end-to-end ✅

#### 3. Invite API
- [ ] `POST /api/battles/invite` — Create battle with invite code (returns code + link)
- [ ] `GET /api/battles/invite/:code` — Get battle info from invite code
- [ ] `POST /api/battles/invite/:code/join` — Join battle via invite code
- [ ] Swagger documentation
- [ ] **Success Criteria:** API tests passing ✅

#### 4. In-app Invite
- [ ] `POST /api/battles/:id/invite-user` — Send invite notification to user by username
- [ ] WebSocket event `battle.invite_received` — Notify target user of invite
- [ ] **Success Criteria:** In-app invites work ✅

#### 5. Tests
- [ ] Invite code generation tests
- [ ] Join by code tests (valid, expired, full battle)
- [ ] In-app invite notification tests
- [ ] **Success Criteria:** All invite tests passing ✅

---

## 📋 TODO - Friends System (MEDIUM PRIORITY)

Social connections between players.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `Friendship` model (id, requesterId, addresseeId, status: PENDING/ACCEPTED/DECLINED, createdAt, updatedAt)
- [ ] Unique constraint on [requesterId, addresseeId]
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Friends Service
- [ ] Create `friends/` module
- [ ] `sendRequest(requesterId, addresseeUsername)` — Send friend request
- [ ] `acceptRequest(userId, friendshipId)` — Accept friend request
- [ ] `declineRequest(userId, friendshipId)` — Decline friend request
- [ ] `removeFriend(userId, friendId)` — Remove friend
- [ ] `getFriends(userId)` — List accepted friends with online status
- [ ] `getPendingRequests(userId)` — List incoming pending requests
- [ ] **Success Criteria:** All friend operations work ✅

#### 3. Friends API
- [ ] `POST /api/friends/request` — Send friend request (body: { username })
- [ ] `POST /api/friends/:id/accept` — Accept request
- [ ] `POST /api/friends/:id/decline` — Decline request
- [ ] `DELETE /api/friends/:id` — Remove friend
- [ ] `GET /api/friends` — List friends (with online status)
- [ ] `GET /api/friends/requests` — List pending requests
- [ ] Swagger documentation
- [ ] **Success Criteria:** API tests passing ✅

#### 4. Online Presence
- [ ] Track online status in WebSocket gateway (user connects/disconnects)
- [ ] `presence.online` / `presence.offline` events broadcast to friends
- [ ] `getOnlineStatus(userIds)` — Bulk check online status
- [ ] **Success Criteria:** Online status accurate ✅

#### 5. Tests
- [ ] Friend request flow tests (send, accept, decline, remove)
- [ ] Duplicate request prevention tests
- [ ] Online presence tests
- [ ] **Success Criteria:** All friend tests passing ✅

---

## 📋 TODO - Chat System (MEDIUM PRIORITY)

Real-time messaging via Socket.IO.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `Message` model (id, senderId, content, roomType: BATTLE/LOBBY/DM, roomId, createdAt)
- [ ] Add `Conversation` model (id, type: DM/GROUP, participantIds, createdAt)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Chat Gateway (Socket.IO)
- [ ] Create `chat/` module with its own Socket.IO namespace `/chat`
- [ ] `chat.send` (client → server) — `{ roomType, roomId, content }`
- [ ] `chat.message` (server → room) — `{ senderId, username, content, timestamp }`
- [ ] `chat.join_room` / `chat.leave_room` — Room management
- [ ] Room types: `battle:{battleId}`, `lobby`, `dm:{conversationId}`
- [ ] **Success Criteria:** Messages sent and received in real-time ✅

#### 3. Chat API (History)
- [ ] `GET /api/chat/:roomType/:roomId` — Get message history (paginated)
- [ ] `GET /api/chat/conversations` — List user's DM conversations
- [ ] `POST /api/chat/conversations` — Create DM conversation with user
- [ ] **Success Criteria:** Chat history loads ✅

#### 4. Integration
- [ ] Battle chat: auto-join chat room when joining battle room
- [ ] Lobby chat: global chat room for logged-in users
- [ ] DM: private conversations between two users
- [ ] **Success Criteria:** All chat types work ✅

#### 5. Tests
- [ ] Message send/receive tests
- [ ] Room management tests
- [ ] Chat history pagination tests
- [ ] **Success Criteria:** All chat tests passing ✅

---

## 📋 TODO - Clan Challenge System (MEDIUM PRIORITY)

Clan vs Clan war challenges.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `ClanChallenge` model (id, challengerClanId, challengedClanId, status: PENDING/ACCEPTED/DECLINED/COMPLETED, battleId, message, createdAt, respondedAt)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Challenge Service
- [ ] `sendChallenge(clanId, targetClanId, message?)` — Send clan challenge (owner only)
- [ ] `acceptChallenge(challengeId, userId)` — Accept challenge (target clan owner)
- [ ] `declineChallenge(challengeId, userId)` — Decline challenge
- [ ] `getPendingChallenges(clanId)` — List incoming challenges
- [ ] Auto-create CLAN_VS_CLAN battle on accept
- [ ] **Success Criteria:** Challenge flow works ✅

#### 3. Challenge API
- [ ] `POST /api/clans/:id/challenge` — Send challenge
- [ ] `POST /api/clans/challenges/:id/accept` — Accept
- [ ] `POST /api/clans/challenges/:id/decline` — Decline
- [ ] `GET /api/clans/:id/challenges` — List challenges for clan
- [ ] **Success Criteria:** API tests passing ✅

#### 4. WebSocket Notifications
- [ ] `clan.challenge_received` — Notify clan members of incoming challenge
- [ ] `clan.challenge_accepted` — Notify both clans
- [ ] **Success Criteria:** Notifications work ✅

#### 5. Tests
- [ ] Challenge send/accept/decline tests
- [ ] Owner-only validation tests
- [ ] Battle creation on accept tests
- [ ] **Success Criteria:** All challenge tests passing ✅

---

## 📋 TODO - MMR Scaling System (HIGH PRIORITY)

MMR gains/losses scale based on the number of problems in a battle. More problems = higher stakes.

### Design

| Problem Count | MMR Multiplier | Example Win (vs equal MMR) |
|---------------|----------------|---------------------------|
| 1 problem | 1x (base) | ~+16 MMR |
| 2 problems | 2x | ~+32 MMR |
| 3 problems | 3x | ~+48 MMR |
| 5 problems | 5x | ~+80 MMR |

**Formula:** `K-factor = BASE_K * problemCount` where `BASE_K = 16`

The Elo formula stays the same, but K-factor scales linearly with problem count.
This means a 3-question battle has 3x the MMR at stake compared to a 1-question battle.

### Default Problem Counts
| Context | Default Problem Count |
|---------|-----------------------|
| Public matchmaking (1v1) | 1 problem |
| Private invite (1v1) | Configurable (1-5, default 1) |
| Battle Royale (per round) | 1 problem per round |
| Clan vs Clan / Group | Uses problem pool (existing point system) |

### Task Breakdown:

#### 1. Schema Updates
- [ ] Add `problemCount` field to Battle model (Int, default 1, min 1, max 5)
- [ ] Add `problemCount` to `CreateBattleDto` (optional, default 1, validated 1-5)
- [ ] For multi-problem 1v1: add `problemIds` support (array of problem IDs) or random selection
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles, migration runs clean ✅

#### 2. Multi-Problem 1v1 Flow
- [ ] When `problemCount > 1` for 1v1: select N random problems (by difficulty preference)
- [ ] Players solve problems sequentially (solve problem 1 → problem 2 → ...)
- [ ] OR all problems visible at once (player chooses order)
- [ ] Track per-problem results in `BattleParticipant` (update `submissions` JSON or add `BattleSubmission` model)
- [ ] Winner = most total test cases passed across all problems, tiebreaker = fastest total time
- [ ] **Success Criteria:** Multi-problem battles work end-to-end ✅

#### 3. MMR Calculation Update
- [ ] Change `ELO_K_FACTOR` from flat 32 to `BASE_K * battle.problemCount`
- [ ] Set `BASE_K = 16` (so 1 problem = K16, 2 = K32 same as before, 3 = K48, etc.)
- [ ] Update `calculateMmrChanges()` to accept `problemCount` parameter
- [ ] Ensure Battle Royale uses per-round K-factor (1 problem per round = base K)
- [ ] Clan/Group battles continue using existing point-based system (unchanged)
- [ ] **Success Criteria:** MMR changes scale correctly with problem count ✅

#### 4. Matchmaking Integration
- [ ] Public matchmaking always creates 1-problem battles (default, no config needed)
- [ ] Add `problemCount` to matchmaking queue entry (for future: match by preferred problem count)
- [ ] **Success Criteria:** Public matches use default problem count ✅

#### 5. Tests
- [ ] MMR calculation with problemCount=1 (K=16, smaller changes than before)
- [ ] MMR calculation with problemCount=3 (K=48, larger changes)
- [ ] MMR calculation with problemCount=5 (K=80, highest stakes)
- [ ] Verify multi-problem winner determination
- [ ] Verify matchmaking default problem count
- [ ] **Success Criteria:** All MMR scaling tests passing ✅

---

## 📋 TODO - Rank Tiers (HIGH PRIORITY)

Humorous rank names with icons and colors.

### Task Breakdown:

#### 1. Rank Definitions
| Rank | MMR Range | Icon | Color |
|------|-----------|------|-------|
| Bug | < 800 | 🐛 | `#22c55e` Green |
| Intern | 800–999 | 📎 | `#9ca3af` Gray |
| Copy Paster | 1000–1199 | 📋 | `#cd7f32` Bronze |
| Stack Overflow Andy | 1200–1399 | 🔍 | `#c0c0c0` Silver |
| Code Monkey | 1400–1599 | 🐒 | `#ffd700` Gold |
| 10x Dev | 1600–1899 | ⚡ | `#3b82f6` Diamond Blue |
| Cracked | 1900+ | 💀 | `#ef4444` Red / Legendary glow |

#### 2. Implementation
- [ ] Create `getRankTier(mmr)` utility function returning `{ name, icon, color, minMmr, maxMmr }`
- [ ] Add rank tier data to `GET /api/users/:id/stats` response
- [ ] Add rank tier to user leaderboard response
- [ ] Add rank tier to battle results (show both players' ranks)
- [ ] **Success Criteria:** Rank tiers returned correctly in API ✅

#### 3. Tests
- [ ] Boundary tests for each tier (799 → Bug, 800 → Intern, 1900 → Cracked, etc.)
- [ ] **Success Criteria:** All rank tier tests passing ✅

---

## 📋 TODO - Battle Royale Elimination (MEDIUM PRIORITY)

Multi-round elimination for Battle Royale mode.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `BattleRound` model (id, battleId, roundNumber, problemId, status: IN_PROGRESS/COMPLETED, eliminatedUserIds, startedAt, endedAt)
- [ ] Add `totalRounds`, `currentRound`, `playersPerElimination` fields to Battle model
- [ ] Add `battleRoyaleFormat` enum: `SAME_PROBLEM`, `PROBLEM_BANK`, `SCORE_BASED` (all configurable by creator)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Elimination Logic
- [ ] 6 players: 3 rounds (eliminate 2 → 2 → final 2 decide winner)
- [ ] 8 players: 3 rounds (eliminate 3 → 3 → final 2 decide winner)
- [ ] Each round: assign problem, wait for submissions, rank by tests passed + speed
- [ ] Eliminate lowest N players per round
- [ ] Configurable format per game:
  - [ ] `SAME_PROBLEM` — Everyone gets same problem each round, slowest eliminated
  - [ ] `PROBLEM_BANK` — Score across problems, lowest total eliminated
  - [ ] `SCORE_BASED` — Cumulative points, lowest eliminated each round
- [ ] **Success Criteria:** Multi-round elimination works ✅

#### 3. WebSocket Events
- [ ] `battle.round_start` — New round starts with problem
- [ ] `battle.round_end` — Round ends, show eliminated players
- [ ] `battle.elimination` — Player eliminated notification
- [ ] `battle.royale_standings` — Current standings broadcast
- [ ] **Success Criteria:** All BR events emit correctly ✅

#### 4. API Updates
- [ ] Add `battleRoyaleFormat` and `maxPlayers` to `CreateBattleDto` for BR mode
- [ ] `GET /api/battles/:id/rounds` — Get round details
- [ ] **Success Criteria:** BR API works ✅

#### 5. Tests
- [ ] 6-player elimination flow tests
- [ ] 8-player elimination flow tests
- [ ] All three format mode tests
- [ ] Round transition tests
- [ ] **Success Criteria:** All BR tests passing ✅

---

## 📋 TODO - Advanced Rankings (MEDIUM PRIORITY)

Enhanced leaderboard features.

### Task Breakdown:

#### 1. Time-based Rankings
- [ ] Daily leaderboard (filter by games played today)
- [ ] Weekly leaderboard
- [ ] Monthly leaderboard
- [ ] All-time leaderboard (already exists)
- [ ] **Success Criteria:** Time-based queries working ✅

#### 2. Ranking APIs
- [ ] `GET /api/rankings/global?period=daily|weekly|monthly|alltime`
- [ ] `GET /api/rankings/clans`
- [ ] `GET /api/rankings/friends` — Leaderboard among friends (requires friends system)
- [ ] Filter by language (most wins with specific language)
- [ ] **Success Criteria:** API tests passing ✅

#### 3. Tests
- [ ] Time-based filter tests
- [ ] Clan ranking tests
- [ ] Friends ranking tests
- [ ] Language filter tests
- [ ] **Success Criteria:** All ranking tests passing ✅

---

## 📋 TODO - Push Notifications (MEDIUM PRIORITY)

Browser push notifications for key events.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `PushSubscription` model (id, userId, endpoint, p256dh, auth, createdAt)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Push Service
- [ ] Create `notifications/` module
- [ ] `subscribe(userId, subscription)` — Store push subscription
- [ ] `unsubscribe(userId, endpoint)` — Remove push subscription
- [ ] `sendNotification(userId, title, body, data?)` — Send push to user
- [ ] Generate VAPID keys for web push
- [ ] **Success Criteria:** Push notifications delivered ✅

#### 3. Integration Points
- [ ] Notify on: match found, battle invite received, friend request, clan challenge
- [ ] `POST /api/notifications/subscribe` — Register push subscription
- [ ] `DELETE /api/notifications/subscribe` — Unregister
- [ ] **Success Criteria:** Notifications fire for all triggers ✅

#### 4. Tests
- [ ] Subscription storage tests
- [ ] Notification delivery tests
- [ ] **Success Criteria:** All notification tests passing ✅

---

## 📋 TODO - Achievements System (LOW PRIORITY)

Player achievement tracking and badges.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `Achievement` model (id, key, name, description, icon, category)
- [ ] Add `UserAchievement` model (id, userId, achievementId, unlockedAt)
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Achievement Definitions
| Key | Name | Description | Trigger |
|-----|------|-------------|---------|
| `first_blood` | First Blood | Win your first battle | 1st win |
| `streak_5` | On Fire | Win 5 battles in a row | 5 consecutive wins |
| `streak_10` | Unstoppable | Win 10 battles in a row | 10 consecutive wins |
| `streak_25` | Legendary | Win 25 battles in a row | 25 consecutive wins |
| `speed_demon` | Speed Demon | Solve a problem in under 2 minutes | Submit < 120s |
| `comeback_king` | Comeback King | Win after opponent passed more tests first | Win after trailing |
| `language_python` | Pythonista | Win 10 battles using Python | 10 Python wins |
| `language_js` | JS Wizard | Win 10 battles using JavaScript | 10 JS wins |
| `clan_champion` | Clan Champion | Win 10 clan wars | 10 clan war wins |
| `contributor` | Problem Setter | Contribute a problem that gets approved | PR merged |
| `season_rank` | Seasonal Glory | Finish a season in top 100 | Season end |

#### 3. Achievement Service
- [ ] Create `achievements/` module
- [ ] `checkAndUnlock(userId, event)` — Check triggers after battle completion
- [ ] `getUserAchievements(userId)` — List unlocked achievements
- [ ] `getAllAchievements()` — List all available achievements
- [ ] **Success Criteria:** Achievements unlock correctly ✅

#### 4. Achievement API
- [ ] `GET /api/achievements` — List all achievements (with unlock status for auth'd user)
- [ ] `GET /api/users/:id/achievements` — List user's unlocked achievements
- [ ] **Success Criteria:** API tests passing ✅

#### 5. Integration
- [ ] Call `checkAndUnlock()` after battle completion
- [ ] WebSocket event `achievement.unlocked` — Notify user of new achievement
- [ ] **Success Criteria:** Achievements trigger correctly ✅

#### 6. Tests
- [ ] Achievement trigger tests (each achievement type)
- [ ] Duplicate unlock prevention tests
- [ ] **Success Criteria:** All achievement tests passing ✅

---

## 📋 TODO - Problem Contribution Pipeline (LOW PRIORITY)

Import community-contributed problems from the repo.

### Task Breakdown:

#### 1. Problem Format in Repo
```
problems/
  two-sum/
    description.md       # Title, description, constraints, hints, complexity
    testcases.json       # Array of { input, expectedOutput, isHidden }
    starter-code/
      javascript.js
      python.py
      typescript.ts
      java.java
      cpp.cpp
      c.c
      rust.rs
    solution/
      editorial.md       # Solution explanation
      solution.py        # Reference solution
  ```

#### 2. Import Script
- [ ] Create `scripts/import-problems.ts` — CLI script to import from `problems/` directory
- [ ] Parse `description.md` frontmatter (title, difficulty, tags, constraints, complexity)
- [ ] Import test cases from `testcases.json`
- [ ] Import starter code from `starter-code/` directory
- [ ] Upsert logic (update if problem with same slug exists)
- [ ] Dry-run mode (show what would be imported)
- [ ] **Success Criteria:** Script imports problems into DB ✅

#### 3. Validation
- [ ] Validate test cases have input + expectedOutput
- [ ] Validate at least 1 starter code file exists
- [ ] Validate description.md has required frontmatter fields
- [ ] Run reference solution against test cases to verify correctness
- [ ] **Success Criteria:** Invalid problems rejected with clear errors ✅

#### 4. Admin Review Integration
- [ ] `GET /api/problems/pending` — List problems in DRAFT status (admin only)
- [ ] `POST /api/problems/:id/approve` — Approve problem (move to ACTIVE)
- [ ] `POST /api/problems/:id/reject` — Reject problem with reason
- [ ] Add `status` field to Problem model (DRAFT, ACTIVE, REJECTED)
- [ ] **Success Criteria:** Review workflow works ✅

#### 5. Tests
- [ ] Import script tests (valid problem, invalid problem, upsert)
- [ ] Review workflow tests
- [ ] **Success Criteria:** All import tests passing ✅

---

## 📋 TODO - Share Result Image Generation (LOW PRIORITY)

Generate shareable battle result images for social media.

### Task Breakdown:

#### 1. Image Generation
- [ ] Create `share/` module
- [ ] `generateResultImage(battleId)` — Generate battle result card image
- [ ] Include: winner/loser names, rank badges, MMR change, problem title, time taken
- [ ] Pre-written trash talk captions (randomized pool)
- [ ] Use `@vercel/og` or `canvas` (satori) for server-side image generation
- [ ] **Success Criteria:** Image generates correctly ✅

#### 2. API
- [ ] `GET /api/battles/:id/share-image` — Return generated image (PNG)
- [ ] `GET /api/battles/:id/share` — Return public shareable data (JSON for OG tags)
- [ ] **Success Criteria:** Image accessible via URL ✅

#### 3. Tests
- [ ] Image generation tests
- [ ] **Success Criteria:** Share image tests passing ✅

---

## 📋 TODO - Activity Heatmap Data (LOW PRIORITY)

Track daily activity for GitHub-style heatmap on profiles.

### Task Breakdown:

#### 1. Prisma Schema Updates
- [ ] Add `DailyActivity` model (id, userId, date, gamesPlayed, gamesWon, createdAt)
- [ ] Unique constraint on [userId, date]
- [ ] Run migration
- [ ] **Success Criteria:** Schema compiles ✅

#### 2. Implementation
- [ ] Increment `gamesPlayed` / `gamesWon` after each battle completion
- [ ] `GET /api/users/:id/activity?year=2026` — Get 365 days of activity data
- [ ] **Success Criteria:** Heatmap data returns correctly ✅

#### 3. Tests
- [ ] Activity tracking tests
- [ ] Year boundary tests
- [ ] **Success Criteria:** All activity tests passing ✅

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
- [ ] **Subscriptions: All tests passing** ⏳
- [ ] **Skills: All tests passing** ⏳
- [ ] **Invites: All tests passing** ⏳
- [ ] **MMR Scaling: All tests passing** ⏳
- [ ] **Friends: All tests passing** ⏳
- [ ] **Chat: All tests passing** ⏳
- [ ] **Clan Challenges: All tests passing** ⏳
- [ ] **Rank Tiers: All tests passing** ⏳
- [ ] **Battle Royale Elimination: All tests passing** ⏳
- [ ] **Achievements: All tests passing** ⏳
- [ ] **Notifications: All tests passing** ⏳
- [ ] **E2E Tests: Full flow working** ⏳

### E2E Test Scenarios:
- [ ] User signs up → syncs to DB → appears on leaderboard
- [ ] User joins queue → gets matched → battle created → submit code → winner determined → MMR updated
- [ ] Free user plays 1 game → blocked on 2nd → subscribes → can play unlimited
- [ ] Player creates game with skills → invites friend → skills used during battle
- [ ] Battle Royale: 6 players → 3 elimination rounds → winner crowned
- [ ] Clan created → members join → challenge sent → accepted → clan war played
- [ ] Problem contributed via repo → admin reviews → approves → appears in game
- [ ] Share battle result → image generated → opens on social media

---

## 📦 Infrastructure TODOs

### Docker Compose Setup (Optional)
- [ ] Add PostgreSQL service
- [ ] Add Redis for queue management
- [ ] Production-ready docker-compose.yml

### Environment & Config
- [ ] Document all environment variables
- [ ] Add .env.example file (including STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, VAPID keys)
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
  - [ ] WebSocket event flow (including skills, chat, BR rounds)
- [ ] Developer onboarding guide
  - [ ] Local setup instructions
  - [ ] Testing guide
  - [ ] Contributing guidelines (for problem contributions)

---

## 🎯 Success Criteria (Overall)

### Phase 1: Foundation ✅ COMPLETE
- [x] Auth, Users, Problems, Code Execution all implemented
- [x] All tests passing (57/57)
- [x] API documentation complete

### Phase 2: Core Competition ✅ COMPLETE
- [x] Battles system fully working
- [x] Real-time updates via WebSockets
- [x] Matchmaking functional
- [x] MMR system working
- [x] **All tests passing** ✅

### Phase 3: Monetization & Game Features
- [ ] Subscription/Stripe module working
- [ ] Skills system working (5 skills, single-use, toggleable per game)
- [ ] Direct invite system working (link + in-app)
- [ ] Rank tiers implemented (Bug → Cracked)
- [ ] **All tests passing**

### Phase 4: Social Features
- [ ] Friends system working (request/accept/remove, online status)
- [ ] Chat system working (battle, lobby, DM)
- [ ] Clan challenges working (send/accept/play)
- [ ] Push notifications working
- [ ] **All tests passing**

### Phase 5: Advanced Game Modes
- [ ] Battle Royale elimination rounds working (6-8 players, 3 rounds)
- [ ] Configurable BR formats (same problem, problem bank, score-based)
- [ ] Advanced rankings (time-based, by language, friends, clans)
- [ ] **All tests passing**

### Phase 6: Content & Polish
- [ ] Achievements system working (11 achievement types)
- [ ] Problem contribution pipeline working (repo → import → review → approve)
- [ ] Share result image generation working
- [ ] Activity heatmap data tracking working
- [ ] **All tests passing**

### Phase 7: Production Ready
- [ ] E2E tests passing
- [ ] Performance optimized
- [ ] Security hardened
- [ ] Monitoring in place
- [ ] Deployed to production

---

## 📅 Priority Order

| Module | Priority | Depends On |
|--------|----------|------------|
| Subscription/Stripe | HIGH | — |
| Skills System | HIGH | — |
| Direct Invites | HIGH | — |
| MMR Scaling System | HIGH | — |
| Rank Tiers | HIGH | — |
| Friends System | MEDIUM | — |
| Chat System | MEDIUM | WebSockets (done) |
| Clan Challenges | MEDIUM | Clans (done) |
| Push Notifications | MEDIUM | — |
| Battle Royale Elimination | MEDIUM | Battles (done) |
| Advanced Rankings | MEDIUM | Friends |
| Achievements | LOW | Battles (done) |
| Problem Contribution | LOW | Problems (done) |
| Share Image | LOW | Battles (done) |
| Activity Heatmap | LOW | — |

---

## 💡 Notes

- Subscription module is #1 priority — frontend needs it to gate free users
- Skills system needs both backend + frontend work, plan together
- Battle Royale elimination is a significant backend change — multi-round state machine
- Problem contribution pipeline can use a simple import script initially, no GitHub webhooks needed
- Keep writing tests as you go — don't save them for the end!
- Rank tier is a quick win — just a utility function + DTO changes

---

**Remember:** This feature is only considered successful when ALL test cases pass! ✅
