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

## ✅ Practice Ground - COMPLETED

Free, non-competitive problem-solving mode. Same problem pool as battles, no timer,
no MMR. Attempts are persisted only for PRO/trial users — the FREE experience is
unlimited runs/submits with no history, which doubles as an upsell hook.

### Completed:

**Database schema**
- [x] `PracticeAttempt` model with `(userId, problemId, language, code, passed, testsPassed, totalTests, attemptedAt)`
- [x] Indexes on `(userId, attemptedAt)` and `(userId, problemId)`
- [x] Inverse relations on `User.practiceAttempts` and `Problem.practiceAttempts`

**Practice module (`server/src/practice/`)**
- [x] `PracticeService.submitAttempt` — runs the code, persists only if user is PRO or on active trial
- [x] `PracticeService.getMyAttempts` — paginated attempt history per user
- [x] `PracticeService.getSolvedProblemIds` — O(1) lookup for solved state
- [x] `PracticeService.getMyStats` — totalAttempts, totalSolved, solveRate, per-topic breakdown, per-difficulty counts
- [x] `PracticeService.listProblems` — problem list enriched with `{ solved, attempts }` per user
- [x] Tier gating reuses `SubscriptionsService.isTrialActive` — no new subscription logic
- [x] Swagger-annotated `PracticeController`:
  - `POST /api/practice/attempts` → `{ passed, total, results[], allPassed, saved }`
  - `GET /api/practice/attempts?problemId&page&limit`
  - `GET /api/practice/stats`
  - `GET /api/practice/problems?difficulty&tags&unsolvedOnly`
- [x] All endpoints behind `AuthGuard('jwt')`
- [x] 17 unit tests in `practice.service.spec.ts` (save vs no-save, stats aggregation, solved set, filters) — all passing ✅

**Profile integration**
- [x] `GET /users/:id/stats` now returns a `practice` field (empty for FREE users, aggregated for PRO)

**Seed harness fix (pre-existing bug)**
- [x] Rewrote JS + Python starter code for all 7 seed problems to include stdin parsing + output harness. Previously, starter code was just function signatures — combined with the Piston stdin/stdout runner, Run/Submit never actually worked. Now it does, for both battles and practice.
- [x] Fixed ambiguous Two Sum hidden test case (`[1,5,3,7,9] → [1,3]` had two valid pairs). Replaced with `[1,5,3,2,9] target=11 → [3,4]`.
- [x] Seed is now idempotent for problem fields + test cases (fields update on re-run; test cases delete+recreate).

### Not in this slice (follow-ups):

- [ ] Admin "easy add question" UI at `/admin/problems/new` — calls existing `POST /api/problems`.
- [ ] Reference-solution validator script (run each seed's canonical solution against all tests in CI).

---

## ✅ YAML Problem Authoring + Import Pipeline - COMPLETED

Local-first authoring workflow for defining problems in YAML, previewing them, and importing into Postgres.

### Completed:

**Schema + dependencies**
- [x] Added `js-yaml` + `zod` (and `@types/js-yaml`) for parsing/validation
- [x] Added `server/problems/*.yaml` source-of-truth problem files (7 seeded problems)

**Authoring domain (`server/src/problems/authoring/`)**
- [x] Zod schema for YAML contract (`problem-yaml.schema.ts`)
- [x] Loader utilities with aggregated validation errors + duplicate id detection
- [x] Dev-only controller/module (`/author/*`) gated behind `ENABLE_AUTHOR_TOOLS=true`
- [x] Dry-run endpoint (`POST /author/dry-run`) executes `{prefix, body, suffix}` harness without DB writes
- [x] Import script (`import-problems.ts`) upserts problems and replace-syncs test cases

**Execution pipeline hardening**
- [x] Introduced starter-code helpers (`parseStarterCode`, `stitchSource`, `serializeStarterCode`)
- [x] `CodeExecutionService` now stitches user body into stored harness before execution
- [x] Added explicit "empty output" guidance when code runs but prints nothing
- [x] Added `executeWithHarness` for authoring dry-runs

**Integration**
- [x] Registered `PracticeModule` in `AppModule` and surfaced practice stats via `UsersService`
- [x] Updated tests/mocks for starter harness and new practice stats dependency
- [x] Updated docs (`server/readme.md`) for the new authoring/import flow

### Follow-ups:

- [ ] Add CI job to run YAML validation + importer dry-run on PRs
- [ ] Add reference-solution verification per YAML problem before import

### v2 authoring + console UX improvements (newly completed):

- [x] Migrated all seed YAMLs from v1 `{languages.{prefix,body,suffix}, testCases}` to v2 `{signature, starter, tests}`
- [x] Added v2 codegen (`harness-codegen.ts`) for JS/Python with `<<<CQ_ANSWER>>>` marker protocol
- [x] Kept v1 backward compatibility in schema/loader/importer and dry-run endpoint
- [x] Added JSON-canonical output comparison to avoid whitespace/formatting false negatives
- [x] Split debug stdout from graded answer and surfaced per-test `stdout`/`stderr` in API + UI Console panel

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
- [x] MMR updates for winners/losers (K-factor = 16)
- [x] Win/loss counters update
- [x] MMR floor at 0 (can never go negative)

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
  - [x] `getBattleHistory(clanId, page, limit)` - Get clan's battle history with win/loss/draw results
- [x] REST endpoints with Swagger docs
  - [x] `GET /clans/:id/battles` - Paginated battle history endpoint
- [x] Seed data (MIT Hackers, Harvard Coders)
- [x] Wins/losses tracking (incremented on battle completion)

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
- [x] Wins/losses counters updated on battle completion

#### 6. Tests ✅
- [x] CLAN_VS_CLAN mode tests (3 tests)
- [x] GROUP mode tests (2 tests)
- [x] Clan battle history tests (5 tests in clans.service.spec.ts)
- [x] All battles.service.spec.ts tests passing (31 tests - added clan wins/losses test)
- [x] All clans.service.spec.ts tests passing (5 tests)

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
- [x] Clan challenge system ✅

---

## ✅ Subscription & Stripe Module - COMPLETED

Payment system for frontend monetization.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `Subscription` model (id, userId, stripeSubscriptionId, stripePriceId, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd)
- [x] Add `gamesPlayedToday`, `lastGameResetAt`, `trialEndsAt`, `hasUsedTrial` fields to User model
- [x] Add `subscriptionTier` enum (FREE, PRO) to User model
- [x] Add subscription relation to User model
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Subscription Service ✅
- [x] Create `subscriptions/` module
- [x] `createCheckoutSession(userId, plan)` — Create Stripe hosted checkout session (bimonthly or yearly)
- [x] `handleWebhookEvent(event)` — Process Stripe webhook events (checkout.session.completed, customer.subscription.created/updated/deleted, invoice.payment_failed)
- [x] `getSubscriptionStatus(userId)` — Return tier, gamesRemaining, resetsAt
- [x] `canPlay(userId)` — Check if user can start a game (pro, trial, OR gamesPlayedToday < 1)
- [x] `incrementGamesPlayed(userId)` — Called when a battle starts
- [x] `resetAllDailyGameCounts()` — Cron job at midnight UTC
- [x] `startTrial(userId)` — 7-day free trial (one-time per user)
- [x] `isTrialActive(trialEndsAt)` — Check trial validity
- [x] Stripe customer creation on first checkout
- [x] Lazy daily reset via `checkAndResetDailyGames()`
- [x] **Success Criteria:** Full subscription lifecycle works ✅

#### 3. Subscription API ✅
- [x] `POST /api/subscriptions/checkout` — Create Stripe checkout session (returns redirect URL)
- [x] `POST /api/subscriptions/webhook` — Stripe webhook endpoint (raw body, signature verification)
- [x] `GET /api/subscriptions/status` — Get current user's subscription status
- [x] `POST /api/subscriptions/portal` — Create Stripe customer portal session (manage/cancel sub)
- [x] `POST /api/subscriptions/trial` — Start 7-day free trial
- [x] Swagger documentation
- [x] Authentication guards (except webhook)
- [x] **Success Criteria:** API working ✅

#### 4. Integration with Battles ✅
- [x] Add `canPlay()` check in `BattlesService.createBattle()` and `joinBattle()`
- [x] Add `incrementGamesPlayed()` call when battle starts
- [x] **Success Criteria:** Free users gated after 1 game/day ✅

#### 5. Pricing ✅
- [x] $5 per 2 months (bimonthly) subscription
- [x] $24.99 per year subscription
- [x] 7-day free trial (one-time)
- [x] **Success Criteria:** Stripe checkout works end-to-end ✅

#### 6. Tests ✅
- [x] 39 tests passing
- [x] Checkout session creation tests
- [x] Webhook handling tests (all event types)
- [x] canPlay() logic tests (free vs pro vs trial, daily counter, reset)
- [x] Trial lifecycle tests
- [x] Battle integration tests (gating)
- [x] **Success Criteria:** All subscription tests passing ✅

---

## ✅ Skills System - COMPLETED

In-battle power-ups — toggleable per game, each usable once per battle.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `SkillType` enum: `FREEZE`, `SCRAMBLE`, `BLIND`, `TIME_STEAL`, `FOG_OF_WAR`
- [x] Add `enabledSkills` field to Battle model (JSON array of SkillType, default: [])
- [x] Add `BattleSkillUse` model (id, battleId, userId, targetUserId, skillType, usedAt)
- [x] Run migration
- [x] **Success Criteria:** Schema compiles, migration runs clean ✅

#### 2. Skill Definitions
| Skill | Effect | Duration |
|-------|--------|----------|
| `FREEZE` | Lock opponent's editor | 10 seconds |
| `SCRAMBLE` | Shuffle opponent's code lines | Instant |
| `BLIND` | Hide opponent's test case results | Until next submission |
| `TIME_STEAL` | Reduce opponent's remaining time | -60 seconds |
| `FOG_OF_WAR` | Blur opponent's screen | 20 seconds |

#### 3. Skills Service ✅
- [x] `useSkill(battleId, userId, targetUserId, skillType)` — Validate & record skill use
- [x] Validation: skill is enabled for this battle
- [x] Validation: user hasn't already used this skill in this battle (single-use)
- [x] Validation: battle is IN_PROGRESS
- [x] Validation: target is a participant in the battle
- [x] Validation: user is not targeting themselves
- [x] **Success Criteria:** All validations working ✅

#### 4. WebSocket Events ✅
- [x] `skill.use` (client → server) — `{ battleId, targetUserId, skillType }`
- [x] `skill.effect` (server → client) — `{ skillType, fromUserId, duration }` (sent to target)
- [x] `skill.used` (server → room) — `{ userId, skillType, targetUserId }` (broadcast to room)
- [x] Add skill events to `BattlesGateway`
- [x] **Success Criteria:** Skill events emit correctly ✅

#### 5. Battle Creation Integration ✅
- [x] Add `enabledSkills` to `CreateBattleDto` (optional array of SkillType)
- [x] Store enabled skills on battle creation
- [x] **Success Criteria:** Skills config stored on battle ✅

#### 6. Tests ✅
- [x] Skill use validation tests (enabled check, single-use, in-progress check)
- [x] WebSocket skill event tests
- [x] Battle creation with skills tests
- [x] **Success Criteria:** All skill tests passing ✅

---

## ✅ Direct Invite System - COMPLETED

Allow players to invite each other to games via link or username.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `inviteCode` field to Battle model (unique, nullable, 8-char alphanumeric)
- [x] Add `inviteExpiresAt` field to Battle model (24-hour expiry)
- [x] Add `isReady` field to BattleParticipant model (for ready-up flow)
- [x] Run migration
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Invite Service ✅
- [x] `generateInviteCode()` — Generate unique 8-char uppercase alphanumeric code (excludes ambiguous chars I, O, 0, 1)
- [x] Invite code uniqueness checked against non-completed battles only (completed battles don't block code reuse)
- [x] `createBattle` with `withInviteCode: true` — Create battle with invite code + 24h expiry
- [x] `joinByInviteCode(userId, code)` — Join battle via invite code (case-insensitive)
- [x] `getByInviteCode(code)` — Get battle details from invite code with expiry/status validation
- [x] Direct `joinBattle()` blocked for invite-code battles (must use `joinByInviteCode`)
- [x] Invite-code battles filtered out of `getAvailableBattles()` (private by default)
- [x] Invite-code battles never auto-start on join (require ready-up)
- [x] **Success Criteria:** Invite codes work end-to-end ✅

#### 3. Ready-Up System ✅
- [x] `readyUp(battleId, userId)` — Mark participant as ready (wrapped in DB transaction to prevent race conditions)
- [x] `unready(battleId, userId)` — Toggle ready state off
- [x] Battle auto-starts when all participants are ready
- [x] Minimum 2 participants required to ready up
- [x] Daily game counts incremented at battle start (not at join)
- [x] **Success Criteria:** Ready-up flow works with concurrency safety ✅

#### 4. Invite API ✅
- [x] `POST /api/battles/invite` — Create battle with invite code (returns code + link)
- [x] `GET /api/battles/invite/:code` — Get battle info from invite code
- [x] `POST /api/battles/invite/:code/join` — Join battle via invite code
- [x] `POST /api/battles/:id/ready` — Ready up
- [x] `DELETE /api/battles/:id/ready` — Unready
- [x] Swagger documentation
- [x] **Success Criteria:** API working ✅

#### 5. In-app Invite ✅
- [x] `POST /api/battles/:id/invite-user` — Send invite notification to user by username
- [x] `inviteUserToBattle(battleId, inviterId, targetUsername)` — Validate & return invite data
- [x] WebSocket event `battle.invite_received` — Notify target user of invite (if online)
- [x] WebSocket event `battle.player_ready` — Broadcast ready/unready status to room
- [x] Gateway returns `{ success: true, delivered: boolean }` so inviter knows if target was online
- [x] **Success Criteria:** In-app invites work ✅

#### 6. Tests ✅
- [x] Invite code generation tests (length, charset, retry on collision, max attempts, no ambiguous chars, uniqueness scoped to non-completed)
- [x] Create battle with/without invite code tests
- [x] getByInviteCode tests (valid, case-insensitive, invalid, expired, non-waiting, rank tier)
- [x] joinByInviteCode delegation test
- [x] readyUp tests (mark ready, all-ready starts battle, not found, wrong status, not participant, already ready, not enough players, partial ready, transaction verification)
- [x] unready tests (toggle off, not found, wrong status, not participant, not ready)
- [x] inviteUserToBattle tests (valid, not found, wrong status, not participant, target not found, target already in battle)
- [x] joinBattle invite-code guard tests (direct join blocked, via-invite works, non-invite auto-starts)
- [x] Gateway tests (ready broadcast, battle.started on all ready, unready broadcast, invite_received delivery, offline handling, delivered flag, error handling, auth checks)
- [x] **Success Criteria:** All 132 tests passing (service: 98, gateway: 34) ✅

---

## ✅ Friends System - COMPLETED

Social connections between players.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `FriendshipStatus` enum (PENDING, ACCEPTED, DECLINED)
- [x] Add `Friendship` model (id, requesterId, addresseeId, status, createdAt, updatedAt)
- [x] Add `sentFriendRequests` and `receivedFriendRequests` relations on User
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Friends Service ✅
- [x] Create `friends/` module
- [x] `sendRequest(requesterId, addresseeUsername)` — Send friend request
- [x] `acceptRequest(userId, friendshipId)` — Accept friend request
- [x] `declineRequest(userId, friendshipId)` — Decline friend request
- [x] `removeFriend(userId, friendId)` — Remove friend (returns `{ success: true }`)
- [x] `getFriends(userId)` — List accepted friends (bidirectional lookup)
- [x] `getPendingRequests(userId)` — List incoming pending requests
- [x] `getFriendIds(userId)` — Get friend user IDs (used by WebSocket presence)
- [x] Race condition protection: declined re-request wrapped in `$transaction`
- [x] **Success Criteria:** All friend operations work ✅

#### 3. Friends API ✅
- [x] `POST /api/friends/request` — Send friend request (body: { username })
- [x] `POST /api/friends/:id/accept` — Accept request
- [x] `POST /api/friends/:id/decline` — Decline request
- [x] `DELETE /api/friends/:id` — Remove friend
- [x] `GET /api/friends` — List friends
- [x] `GET /api/friends/requests` — List pending requests
- [x] Swagger documentation
- [x] **Success Criteria:** API working ✅

#### 4. Online Presence ✅
- [x] Track online status in WebSocket gateway (user connects/disconnects)
- [x] `presence.online` / `presence.offline` events broadcast to friends
- [x] `isOnline(userId)` — Check single user online status
- [x] `getOnlineUsers(userIds)` — Bulk check online status
- [x] `notifyFriendsPresence()` — Private helper, called on connect/disconnect
- [x] FriendsModule ↔ WebsocketsModule circular dependency resolved with `forwardRef`
- [x] **Success Criteria:** Online status accurate ✅

#### 5. Tests ✅
- [x] 22 tests passing (friends.service.spec.ts)
- [x] sendRequest: success, not found, self-request, already friends, already pending, declined re-request via transaction
- [x] acceptRequest: success, not found, wrong user, not pending
- [x] declineRequest: success, not found, wrong user, not pending
- [x] removeFriend: success, not found
- [x] getFriends: returns correct friend list, empty array
- [x] getPendingRequests: returns pending requests, empty array
- [x] getFriendIds: returns friend IDs, empty array
- [x] BattlesGateway presence notification tests (in battles.gateway.spec.ts)
- [x] **Success Criteria:** All friend tests passing ✅

---

## ✅ Chat System - COMPLETED

Real-time messaging via Socket.IO with security hardening.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `Message` model (id, senderId, content, roomType: BATTLE/LOBBY/DM, roomId, createdAt)
- [x] Add `Conversation` model (id, type: DM/GROUP, participantIds, createdAt, updatedAt)
- [x] Add `ChatRoomType` and `ConversationType` enums
- [x] Add `sentMessages` relation on User model
- [x] Composite index on `(roomType, roomId, createdAt)` for efficient paginated queries
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Chat Gateway (Socket.IO) ✅
- [x] Create `chat/` module with its own Socket.IO namespace `/chat`
- [x] JWT authentication on connection via `JwtVerificationService`
- [x] `chat.send` (client → server) — `{ roomType, roomId, content }`
- [x] `chat.message` (server → room) — `{ senderId, senderUsername, senderAvatarUrl, content, roomType, roomId, createdAt }`
- [x] `chat.join_room` / `chat.leave_room` — Room management with access control
- [x] `chat.user_joined` / `chat.user_left` — Presence notifications to room members
- [x] Room types: `lobby`, `battle:{battleId}`, `dm:{conversationId}`
- [x] Auto-join lobby room on connect
- [x] **Security:** Room access validated before join (prevents eavesdropping on battles/DMs)
- [x] **Security:** Leave events only fire if client is actually in the room (prevents presence leaks)
- [x] **Security:** Rate limiting — 10 messages per 10-second window per user (in-memory)
- [x] **Security:** Error sanitization — only HttpException messages forwarded to clients
- [x] **Security:** CORS reads from `CORS_ORIGIN` env var (comma-separated), falls back to wildcard
- [x] Multi-device support: `userSocketMap` uses `Map<string, Set<string>>` (multiple tabs/devices)
- [x] **Success Criteria:** Messages sent and received in real-time ✅

#### 3. Chat Service ✅
- [x] `sendMessage(userId, roomType, roomId, content)` — Validate access & persist message
- [x] `getMessages(roomType, roomId, cursor?, limit?)` — Cursor-based pagination (oldest-first), limit capped at 100
- [x] `createConversation(userId, targetUserId)` — Create DM (requires friendship, idempotent)
- [x] `getConversations(userId)` — List conversations with last message & participant info
- [x] `getConversation(conversationId, userId)` — Single conversation with participant check
- [x] `validateRoomAccess(userId, roomType, roomId)` — Public method used by service, gateway, and controller
  - [x] LOBBY: any authenticated user
  - [x] BATTLE: requires `BattleParticipant` record
  - [x] DM: requires conversation membership
  - [x] Default case throws `ForbiddenException` for unknown room types
- [x] **Success Criteria:** All service operations work ✅

#### 4. Chat API (REST) ✅
- [x] `GET /api/chat/conversations` — List user's DM conversations
- [x] `POST /api/chat/conversations` — Create DM conversation (requires friendship)
- [x] `GET /api/chat/:roomType/:roomId` — Get message history (paginated, access-controlled, limit capped at 100)
- [x] Swagger documentation
- [x] Authentication guards
- [x] **Success Criteria:** Chat history loads ✅

#### 5. DTOs ✅
- [x] `SendMessageDto` — content (max 1000 chars), roomType (enum), roomId
- [x] `CreateConversationDto` — targetUserId
- [x] `MessageResponseDto` — Full message response with sender info
- [x] `ConversationResponseDto` — Conversation with participants and last message

#### 6. Integration ✅
- [x] Battle chat: join chat room when joining battle room (access validated)
- [x] Lobby chat: global chat room for logged-in users (auto-join on connect)
- [x] DM: private conversations between friends
- [x] **Success Criteria:** All chat types work ✅

#### 7. Tests ✅
- [x] ChatService: 17 tests passing
  - [x] sendMessage (lobby, battle participant, battle forbidden, DM participant, DM forbidden, DM not found)
  - [x] getMessages (no cursor, with cursor pagination, empty room)
  - [x] createConversation (friends, existing, self, not found, not friends)
  - [x] getConversations (with last message, empty)
  - [x] getConversation (participant, not found, forbidden)
- [x] ChatGateway: 21 tests passing
  - [x] Connection (auth success + lobby join, no token, invalid token)
  - [x] Disconnect (cleanup tracking)
  - [x] chat.send (lobby/battle/DM broadcast, empty content, long content, unauthenticated, service errors)
  - [x] chat.join_room (success with access validation, access denied, unauthenticated)
  - [x] chat.leave_room (success with room check, not-in-room no-op, unauthenticated)
  - [x] Client tracking (multiple clients, non-connected user)
- [x] **Success Criteria:** All 38 chat tests passing ✅

#### 8. Module ✅
- [x] `ChatModule` imports `AuthModule` and `FriendsModule` (forwardRef)
- [x] Provides `ChatService`, `ChatGateway`, `WsAuthGuard`
- [x] Exports `ChatService` and `ChatGateway` for use by other modules
- [x] Registered in `AppModule`
- [x] Mock Prisma service updated with `message` and `conversation` models

---

## ✅ Clan Challenge System - COMPLETED

Clan vs Clan war challenges with negotiable battle settings.

### Completed:

#### 1. Prisma Schema Updates ✅
- [x] Add `ClanChallengeStatus` enum (PENDING, ACCEPTED, DECLINED, COUNTERED, EXPIRED)
- [x] Add `ClanChallenge` model (id, challengerClanId, challengedClanId, status, message, battle config, counter config, expiresAt, respondedAt)
- [x] Add `sentChallenges`/`receivedChallenges` relations on Clan model
- [x] Run `prisma generate`
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Challenge Service ✅
- [x] Create `ClanChallengeService` (separate from ClansService)
- [x] `sendChallenge(userId, dto)` — Send clan challenge with proposed battle config (owner only)
- [x] `acceptChallenge(userId, challengeId)` — Accept challenge (PENDING: challenged owner, COUNTERED: challenger owner)
- [x] `declineChallenge(userId, challengeId)` — Decline challenge (respective clan owner)
- [x] `counterChallenge(userId, challengeId, dto)` — Counter-propose with different settings (single counter, resets 24h expiry)
- [x] `getChallenges(clanId, userId)` — List all challenges (marks expired in response)
- [x] `getPendingChallenges(clanId, userId)` — List active (non-expired PENDING/COUNTERED) challenges
- [x] `getClanMemberIds(clanId)` — Get member IDs for WebSocket notifications
- [x] Validations: ownership, expiry, duplicate prevention, self-challenge, status checks
- [x] Battle creation handled separately (not auto-created on accept)
- [x] **Success Criteria:** Challenge flow works ✅

#### 3. Challenge API ✅
- [x] `POST /api/clans/challenges` — Send challenge (body: SendChallengeDto)
- [x] `POST /api/clans/challenges/:id/accept` — Accept challenge
- [x] `POST /api/clans/challenges/:id/decline` — Decline challenge
- [x] `POST /api/clans/challenges/:id/counter` — Counter-propose (body: CounterChallengeDto)
- [x] `GET /api/clans/:id/challenges` — List challenges for clan (?pending=true for active only)
- [x] Swagger documentation
- [x] Authentication guards
- [x] **Success Criteria:** API working ✅

#### 4. WebSocket Notifications ✅
- [x] `clan.challenge_received` — Notify all online members of challenged clan
- [x] `clan.challenge_accepted` — Notify all online members of both clans
- [x] `clan.challenge_declined` — Notify all online members of both clans
- [x] `clan.challenge_countered` — Notify all online members of challenger clan
- [x] `emitToClanMembers(memberIds, event, data)` — Reusable gateway helper
- [x] **Success Criteria:** Notifications work ✅

#### 5. DTOs ✅
- [x] `SendChallengeDto` — targetClanId, message (max 500), teamSize (2/3/5), timeLimitMinutes (1-120), enabledSkills, preferredTopic
- [x] `CounterChallengeDto` — counterMessage, teamSize, timeLimitMinutes, enabledSkills, preferredTopic
- [x] `ChallengeResponseDto` — Full response with both original and counter config, clan info, status

#### 6. Tests ✅
- [x] 30 clan-challenges.service.spec.ts tests passing
  - [x] sendChallenge: success, no clan, not owner, self-challenge, target not found, duplicate active challenge
  - [x] acceptChallenge: PENDING (challenged owner), COUNTERED (challenger owner), not found, expired, wrong owner, wrong status
  - [x] declineChallenge: PENDING, COUNTERED, not found, expired, wrong owner
  - [x] counterChallenge: success, not PENDING, expired, wrong owner, not found, expiry reset
  - [x] getChallenges: returns all, marks expired, forbidden if not member
  - [x] getPendingChallenges: filters active, forbidden if not member
  - [x] getClanMemberIds: returns IDs, empty array
- [x] 4 gateway tests (emitToClanMembers: all online, skip offline, no online, multiple events)
- [x] **Success Criteria:** All 34 challenge tests passing ✅

---

## ✅ MMR Rebalance - COMPLETED

Rebalanced MMR system with standard Elo K=16 and MMR floor.

### Completed:
- [x] K-factor changed from 32 to 16 (smaller, more stable gains/losses)
- [x] MMR floor at 0 (can never go negative)
- [x] All MMR calculation tests updated and passing (31 tests)
- [x] **Success Criteria:** All tests passing ✅

---

## ✅ Topic Tags System - COMPLETED

Tag-based topic filtering for problems and matchmaking.

### Completed:

#### 1. Schema & DTOs ✅
- [x] Added `tags String[]` to Problem model
- [x] Added `tags` to `CreateProblemDto` (optional string array)
- [x] Added `preferredTopic` to MatchmakingEntry and JoinQueueDto
- [x] Added `preferredTopic` to CreateBattleDto

#### 2. Problem Filtering ✅
- [x] `findAll()` accepts `tags` query param (comma-separated, uses `hasSome`)
- [x] `findRandom()` accepts `tags` param for topic-filtered random selection
- [x] Controller parses comma-separated tags query string

#### 3. Matchmaking Integration ✅
- [x] `joinQueue` stores `preferredTopic`
- [x] `createMatchedBattle` filters problems by topic with fallback (if no problems match topic, retries without filter)

#### 4. Seed Data ✅
- [x] All 7 seed problems tagged: arrays, hash-table, strings, two-pointers, stacks, binary-search, sorting, sliding-window
- [x] **Success Criteria:** All tests passing ✅

---

## ✅ Seasons System - COMPLETED

Competitive seasons with 3-month cycles, MMR hard reset, and historical records.

### Completed:

#### 1. Schema ✅
- [x] `Season` model (id, number, name, isActive, startDate, endDate)
- [x] `SeasonRecord` model (userId, seasonId, peakMmr, peakRankTier, finalMmr, finalRankTier, wins, losses, winRate, isDisplayed)
- [x] `@@unique([userId, seasonId])` constraint on SeasonRecord
- [x] `seasonId` added to Battle model (links battles to seasons)

#### 2. Seasons Service ✅
- [x] `getActiveSeason()` — Get current active season
- [x] `getAllSeasons()` — List all seasons (ordered by number desc)
- [x] `getSeasonById(id)` — Get season details
- [x] `getSeasonRecords(userId)` — Get user's season history with season info
- [x] `toggleDisplaySeason(userId, seasonId)` — Toggle season record visibility on profile
- [x] `updatePeakMmr(userId, currentMmr)` — Track peak MMR (upserts, only updates if higher)
- [x] `incrementSeasonStats(userId, won)` — Track wins/losses with win rate calculation
- [x] `getSeasonLeaderboard(seasonId, options)` — Leaderboard sorted by peakMmr or finalMmr
- [x] `startSeason(name?)` — Auto-increment number, 3-month duration, deactivate previous
- [x] `endSeason(seasonId)` — Finalize records, hard reset ALL users to MMR 1000/wins 0/losses 0
- [x] `processSeasonTransition()` — Daily cron job, auto end/start seasons

#### 3. Seasons API ✅
- [x] `GET /api/seasons` — List all seasons
- [x] `GET /api/seasons/active` — Get active season
- [x] `GET /api/seasons/:id` — Get season details
- [x] `GET /api/seasons/:id/leaderboard` — Season leaderboard (sortBy, limit, offset)
- [x] `GET /api/users/:id/seasons` — Get user's season records
- [x] `POST /api/users/seasons/:seasonId/display` — Toggle season display on profile

#### 4. Integration ✅
- [x] Battles linked to active season on creation
- [x] Peak MMR and win/loss stats updated after each battle (PRO users)
- [x] User profile includes displayed season records
- [x] `season.ended` WebSocket event broadcast to all clients on season transition

#### 5. Seed Data ✅
- [x] Season 1 created in seed (active, 3-month duration)

#### 6. Tests ✅
- [x] 30 season service tests passing
- [x] All existing tests updated and passing (333 total)
- [x] **Success Criteria:** All tests passing ✅

---

## ✅ Rank Tiers - COMPLETED

Humorous rank names with icons and colors.

### Completed:

#### 1. Rank Definitions ✅
| Rank | MMR Range | Icon | Color |
|------|-----------|------|-------|
| Bug | < 800 | 🐛 | `#22c55e` Green |
| Intern | 800–999 | 📎 | `#9ca3af` Gray |
| Copy Paster | 1000–1199 | 📋 | `#cd7f32` Bronze |
| Stack Overflow Andy | 1200–1399 | 🔍 | `#c0c0c0` Silver |
| Code Monkey | 1400–1599 | 🐒 | `#ffd700` Gold |
| 10x Dev | 1600–1899 | ⚡ | `#3b82f6` Diamond Blue |
| Cracked | 1900+ | 💀 | `#ef4444` Red / Legendary glow |

#### 2. Implementation ✅
- [x] Create `getRankTier(mmr)` utility in `src/common/utils/rank-tiers.ts` returning `{ name, icon, color, minMmr, maxMmr }`
- [x] Extract rank tier logic from UsersService into shared utilities
- [x] Add `RankTierDto` in `src/common/dto/rank-tier.dto.ts` for Swagger documentation
- [x] Add rank tier to user leaderboard response (`GET /api/users`)
- [x] Add rank tier to user profile response (`GET /api/users/:id`)
- [x] Add tier to battle details participants (with clan affiliation)
- [x] **Success Criteria:** Rank tiers returned correctly in API ✅

#### 3. Tests ✅
- [x] Boundary tests for each tier (799 → Bug, 800 → Intern, 1900 → Cracked, etc.)
- [x] 18 rank tier tests passing (15 parameterized boundary tests + minMmr/maxMmr tests)
- [x] **Success Criteria:** All rank tier tests passing ✅

---

## ✅ Battle Royale Elimination - COMPLETED

Multi-round elimination for Battle Royale mode.

### Completed:

#### 1. Prisma Schema Updates
- [x] Add `BattleRound` model + `BattleRoundSubmission` model for multi-round state and submissions
- [x] Add Battle Royale fields on `Battle` (`battleRoyaleFormat`, `maxPlayers`, `currentRound`)
- [x] Add `BattleRoyaleFormat` enum support for configurable BR formats (`SAME_PROBLEM`, `SCORE_ATTACK`)
- [x] Update schema + migration flow and wire seed/import usage
- [x] **Success Criteria:** Schema compiles ✅

#### 2. Elimination Logic
- [x] Multi-round elimination flow implemented with configurable per-round elim counts
- [x] Round lifecycle implemented (pending → in progress → completed)
- [x] Same-problem ranking implemented (all passed / tests passed / submission time tie-breakers)
- [x] Score-attack ranking implemented (cumulative points + round points + submission time tie-breakers)
- [x] Eliminate lowest N players each round and auto-advance/finalize winner
- [x] **Success Criteria:** Multi-round elimination works ✅

#### 3. WebSocket Events
- [x] `battle.round_start` — New round starts with problem
- [x] `battle.round_end` — Round ends, show eliminated players
- [x] `battle.elimination` — Player eliminated notification
- [x] `battle.royale_standings` — Current standings broadcast
- [x] **Success Criteria:** All BR events emit correctly ✅

#### 4. API Updates
- [x] Add `battleRoyaleFormat`, `maxPlayers`, and `rounds` to `CreateBattleDto` for BR mode
- [x] `GET /api/battles/royale/presets` — Fetch BR presets
- [x] `GET /api/battles/:id/rounds` — Get all round details
- [x] `GET /api/battles/:id/rounds/:n` — Get specific round details
- [x] `GET /api/battles/:id/standings` — Get current BR standings
- [x] **Success Criteria:** BR API works ✅

#### 5. Tests
- [x] Battle Royale service tests added (round flow, elimination, ranking, finalize/MMR, guards)
- [x] Battles service + gateway + matchmaking tests updated for BR paths
- [x] Prisma mock surface updated for BR models/methods
- [x] **Success Criteria:** BR backend tests added and passing ✅

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
- [x] Users: All tests passing ✅ (29 tests - includes 18 rank tier tests)
- [x] Problems: All tests passing ✅ (15 tests)
- [x] Code Execution: All tests passing ✅ (9 unit + 17 integration = 26 tests)
- [x] **Battles: All tests passing ✅ (88 tests - includes invites, skills, clan wins/losses)**
- [x] **WebSockets (BattlesGateway): All tests passing ✅ (52 tests - includes invites, skills, presence, clan challenges)**
- [x] **Matchmaking: All tests passing ✅ (40 tests)**
- [x] **WsAuthGuard: All tests passing ✅ (8 tests)**
- [x] **Clans: All tests passing ✅ (5 tests)**
- [x] **Subscriptions: All tests passing ✅ (42 tests)**
- [x] **Seasons: All tests passing ✅ (30 tests)**
- [x] **Friends: All tests passing ✅ (22 tests)**
- [x] **Chat: All tests passing ✅ (38 tests - 19 service + 19 gateway)**
- [x] **Clan Challenges: All tests passing ✅ (30 service + 4 gateway = 34 tests)**
- [x] **Battle Royale Elimination: All tests passing** ✅
- [ ] **Achievements: All tests passing** ⏳
- [ ] **Notifications: All tests passing** ⏳
- [ ] **E2E Tests: Full flow working** ⏳

**Total: 432 tests passing** ✅

### E2E Test Scenarios:
- [ ] User signs up → syncs to DB → appears on leaderboard
- [ ] User joins queue → gets matched → battle created → submit code → winner determined → MMR updated
- [ ] Free user plays 1 game → blocked on 2nd → subscribes → can play unlimited
- [ ] Player creates game with skills → invites friend → skills used during battle
- [x] Battle Royale: elimination rounds → winner crowned
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

## 🧹 NestJS Consistency Refactors

These are codified in `.cursor/rules/server.mdc` — fix the existing offenders so the
codebase actually matches the rules. Each refactor lands as its own focused PR,
ordered from cheap and mechanical to structural.

### Sequencing (13 PRs)

```
PR1 ──► PR2 ──┐
   └──► PR3 ──┴──► PR4 ──► PR5 ──► PR6..PR13 (per-controller DTO audit)
```

PR 1 (shared `AuthedRequest` + standardize on `req.user.id`) is being executed
now under a separate plan; PRs 2–13 below are queued.

### PR 2 — `ParseIntPipe` migration

Replace hand-rolled `parseInt(x, 10)` with `@Query('x', new ParseIntPipe({ optional: true })) x?: number`.

- [ ] `server/src/users/users.controller.ts` lines 49-50, 114, 170
- [ ] `server/src/practice/practice.controller.ts` lines 74-75
- [ ] `server/src/battles/battles.controller.ts` lines 279-280, **and** line 439 (`@Param('n')` → `ParseIntPipe`); after migration delete the manual `Number.isInteger` guard since the pipe handles it.
- [ ] `server/src/chat/chat.controller.ts` line 82
- [ ] `server/src/clans/clans.controller.ts` lines 54-55
- [ ] `server/src/problems/problems.controller.ts` lines 96-97
- [ ] `server/src/seasons/seasons.controller.ts` lines 63-64

Update each handler's service signature to accept `number | undefined` directly so the pipe transform isn't undone downstream.

### PR 3 — Remove `as any` from production code

Four sites; each gets a real type instead of an escape:

- [ ] `server/src/battles/battles.controller.ts` line 467 — widen `BattlesService.getBattleDetails`'s return type to include `currentRound: number` (it already exists on the Prisma `Battle` row), then drop the cast in `getStandings`.
- [ ] `server/src/auth/strategies/jwt.strategy.ts` line 41 — `done`'s second arg type is `string | Buffer`; convert via `publicKey.export({ type: 'spki', format: 'pem' })` and pass the resulting string.
- [ ] `server/src/clans/clan-challenges.service.ts` line 268 (`enabledSkills as any`) and line 260 (`rawRounds as any[]`) — declare the actual JSON shape via a typed `interface` and parse with a narrowing check.
- [ ] `server/src/seasons/seasons.controller.ts` line 93 (`(req as any).user?.id`) — already covered if PR 1 lands first, but verify after merge.

(`*.spec.ts` files also use `as any` — acceptable for now, but worth fixing if it's cheap.)

### PR 4 — Extract shared submission types out of `battles.service.ts`

Today `server/src/battles/battle-royale.service.ts` and `server/src/battles/clan-wars.service.ts` import `SubmissionResult` from `./battles.service`, while `battles.service.ts` imports both back — a circular **TypeScript** import (separate from the Nest provider cycle).

- [ ] Create `server/src/battles/types/battle-submission.types.ts` with `SubmissionResult` and any other shapes shared across `battles.service.ts` ↔ `battle-royale.service.ts` ↔ `clan-wars.service.ts`.
- [ ] Update all three to import from the new file.
- [ ] This is a pure structural-types move; no runtime change.

### PR 5 — `BattleEventsEmitter` port + `forwardRef` purge

This is the structural fix for **~20+ `forwardRef`s**. Today every domain service that wants to emit a WebSocket event injects the concrete `BattlesGateway` via `forwardRef`, which forces both `Battles ↔ Websockets` and `Friends ↔ Websockets` symmetric module cycles plus knock-on `forwardRef`s in `Lobby`, `Seasons`, `BR`, `CW`, `Friends`, and `ClansController`.

Plan:

1. **Define a port module.** Create `server/src/realtime/` with:
    - [ ] `realtime.module.ts` (exports the port tokens; lives separately from `WebsocketsModule`).
    - [ ] `ports/battle-events.port.ts` — `interface BattleEventsPort { emitBattleSubmission(...); emitBattleCompleted(...); emitRoyaleRoundEnded(...); ... }` plus tokens like `BATTLE_EVENTS_PORT`.
    - [ ] `ports/friend-events.port.ts` — `emitFriendRequestReceived/Accepted/Declined`.
    - [ ] `ports/clan-events.port.ts` — `emitToClanMembers` for `ClansController`.
    - [ ] `ports/season-events.port.ts` — `emitSeasonEnded`.
    - [ ] `ports/presence.port.ts` — `isOnline`, `getSocketByUserId`, `getConnectedClients` (used by `LobbyService`).
2. **Implement the ports in `WebsocketsModule`.** Each port gets a thin adapter that delegates to `BattlesGateway`. `WebsocketsModule` provides the adapter classes under their `*_PORT` tokens. Domain services consume the **token**, not the gateway.
3. **Refactor consumers:**
    - [ ] `server/src/friends/friends.service.ts` — swap `BattlesGateway` for `FriendEventsPort`; drop `forwardRef` (lines 7, 20).
    - [ ] `server/src/seasons/seasons.service.ts` — swap for `SeasonEventsPort`; drop `forwardRef` (lines 7, 20).
    - [ ] `server/src/lobby/lobby.service.ts` — swap for `PresencePort`; drop `forwardRef` (line 34).
    - [ ] `server/src/battles/battle-royale.service.ts` — swap for `BattleEventsPort`; drop `forwardRef` (line 85).
    - [ ] `server/src/battles/clan-wars.service.ts` — same as above (line 111).
    - [ ] `server/src/battles/battles.service.ts` — swap `BattlesGateway` for `BattleEventsPort` (lines 77-82). The remaining `forwardRef`s on `BattleRoyaleService`/`ClanWarsService` are addressed in step 5.
    - [ ] `server/src/clans/clans.controller.ts` — swap `BattlesGateway` injection for `ClanEventsPort`.
4. **Delete `forwardRef` from module imports** that are no longer needed:
    - [ ] `server/src/battles/battles.module.ts` — remove `forwardRef(() => WebsocketsModule)`; import `RealtimeModule` instead.
    - [ ] `server/src/websockets/websockets.module.ts` — keep `BattlesService` injection only where the gateway needs to read battle state; if mutual provider cycle remains, keep one `forwardRef` and add a one-line comment per the rule.
    - [ ] `server/src/friends/friends.module.ts`, `server/src/seasons/seasons.module.ts`, `server/src/lobby/lobby.module.ts`, `server/src/clans/clans.module.ts`, `server/src/chat/chat.module.ts` — drop the matching `forwardRef`s.
5. **One-way `forwardRef` cleanup.** `server/src/clans/clan-challenges.service.ts` line 33 injects `ClanWarsService` one-way; once `ClansModule` no longer needs `forwardRef(() => BattlesModule)` it can drop the `forwardRef` on the constructor too. Verify and remove.
6. **Remaining `forwardRef`s.** A small residual cycle (`BattlesGateway` ↔ `BattlesService` for command handlers like `useSkill`, `readyUp`) likely remains. Keep it with a one-line comment — that satisfies the rule.

Acceptance: `rg "forwardRef" server/src` should drop from ~37 hits to a single-digit number, each with a comment.

### PRs 6–13 — Response DTO honesty audit (one PR per controller)

Per the rule: every `@ApiResponse({ type: SomeDto })` must match the service's actual return shape, or drop the `type:`. One PR per controller for safer review.

For each controller, the PR should:
1. Read every `@ApiResponse` claim.
2. Read the service method it delegates to.
3. Either (a) project the result to the DTO via a `toXResponse()` helper modelled on `auth.service.toMeResponse`, or (b) drop the `type:` and keep just `description:`.
4. Audit Prisma `select` lists for leaks (e.g. `stripeCustomerId`, internal flags).

Controllers to cover (one PR each):

- [ ] **PR 6** — `server/src/auth/auth.controller.ts`
- [ ] **PR 7** — `server/src/users/users.controller.ts` — **known offender:** `findOne` claims `UserResponseDto` but the service returns the raw Prisma row plus a derived `tier` field. Add `select`/projection or drop `type:`.
- [ ] **PR 8** — `server/src/clans/clans.controller.ts`
- [ ] **PR 9** — `server/src/battles/battles.controller.ts`
- [ ] **PR 10** — `server/src/friends/friends.controller.ts`
- [ ] **PR 11** — `server/src/practice/practice.controller.ts`
- [ ] **PR 12** — `server/src/subscriptions/subscriptions.controller.ts` — watch for `stripeCustomerId` leaks.
- [ ] **PR 13** — `server/src/lobby/lobby.controller.ts`

### Guard rails (apply across all PRs)

- **Route ordering in `BattlesController`:** static routes (`/royale/presets`, `/clan-wars/presets`, `/history`) **must stay declared above** parameterized routes (`/:id`). The `// MUST come before :id routes` comments on lines 60 and 75 of `server/src/battles/battles.controller.ts` are load-bearing — **do not reorder them** during PR 2, PR 3, or PR 9.
- **Tests:** every PR runs the existing `*.spec.ts` suite (must stay green).
- **No new comments narrating code** — only document non-obvious intent (e.g. the one-line comment next to any surviving `forwardRef`).
- **PrismaModule stays `@Global`** — none of these PRs should re-import it from a feature module.

### Out of scope

- `*.spec.ts` `as any` cleanup (acceptable for now).
- Any client-side changes; this is server-only.
- Phase 4–7 work below (push notifications, achievements, etc.).

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

### Phase 3: Monetization & Game Features (IN PROGRESS)
- [x] Subscription/Stripe module working ✅
- [x] Skills system working (5 skills, single-use, toggleable per game) ✅
- [x] Rank tiers implemented (Bug → Cracked) ✅
- [x] Direct invite system working (link + in-app) ✅
- [x] MMR rebalance (K=16, floor at 0)
- [x] Topic tags and filtering
- [x] Seasons system (3-month cycles, hard reset, leaderboards)
- [x] **All tests passing** ✅

### Phase 4: Social Features
- [x] Friends system working (request/accept/remove, online status) ✅
- [x] Chat system working (battle, lobby, DM) ✅
- [x] Clan challenges working (send/accept/decline/counter, negotiable settings) ✅
- [ ] Push notifications working
- [ ] **All tests passing**

### Phase 5: Advanced Game Modes
- [x] Battle Royale elimination rounds working (configurable rounds and eliminations)
- [x] Configurable BR formats (same problem + score attack)
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
| MMR Rebalance | HIGH | ✅ |
| Topic Tags | MEDIUM | ✅ |
| Seasons System | HIGH | ✅ |
| Rank Tiers | HIGH | — |
| Friends System | MEDIUM | — |
| Chat System | MEDIUM | WebSockets (done) |
| Clan Challenges | ~~MEDIUM~~ ✅ | Clans (done) |
| Push Notifications | MEDIUM | — |
| Battle Royale Elimination | ~~MEDIUM~~ ✅ | Battles (done) |
| Advanced Rankings | MEDIUM | Friends |
| Achievements | LOW | Battles (done) |
| Problem Contribution | LOW | Problems (done) |
| Share Image | LOW | Battles (done) |
| Activity Heatmap | LOW | — |

---

## 💡 Notes

- Subscription module is #1 priority — frontend needs it to gate free users
- Skills system needs both backend + frontend work, plan together
- Battle Royale backend is implemented (service, DTOs, API routes, websocket events, tests)
- Problem contribution pipeline can use a simple import script initially, no GitHub webhooks needed
- Keep writing tests as you go — don't save them for the end!
- Rank tier is a quick win — just a utility function + DTO changes

---

**Remember:** This feature is only considered successful when ALL test cases pass! ✅
