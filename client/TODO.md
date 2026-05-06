# CodeQuest Battles — Client TODO List

**Status:** Frontend development. Ship MVP fast, iterate later.

---

## 📐 Decisions & Constraints

| Decision | Choice |
|----------|--------|
| Framework | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State (global) | Redux Toolkit |
| State (server) | TanStack Query |
| Real-time | Socket.IO Client |
| Code Editor | Monaco Editor |
| Routing | React Router |
| Auth | Supabase (GitHub OAuth + Google OAuth) |
| Payments | Stripe (hosted checkout redirect) |
| Testing | Vitest + React Testing Library + Playwright |
| Theme | Dark mode only |
| Platform | Desktop only |
| Navigation | Top navbar |
| UI Inspiration | neetcode.io + getcracked.io |

---

## 🗺️ Pages & Routes

| Route | Page | Auth | Sub Gate |
|-------|------|------|----------|
| `/` | Landing page | No | No |
| `/login` | OAuth login (GitHub / Google) | No | No |
| `/auth/callback` | OAuth callback handler | No | No |
| `/dashboard` | Main dashboard (home) | Yes | No |
| `/play` | Game creation wizard | Yes | Check |
| `/play/quick` | Quick play from saved preset | Yes | Check |
| `/battle/:id` | Active battle view | Yes | Check |
| `/battle/:id/results` | Post-battle results screen | Yes | No |
| `/battle/:id/results/share` | Public shareable result page | No | No |
| `/invite/:code` | Invite link handler | No | No |
| `/matchmaking` | Matchmaking queue UI | Yes | Check |
| `/practice` | Practice Ground problem list | Yes | No |
| `/practice/:problemId` | Practice solve view | Yes | No |
| `/author` | Dev-only YAML problem list/preview launcher | No | No |
| `/author/problems/:slug` | Dev-only problem preview + dry-run sandbox | No | No |
| `/profile/:username` | Player profile | No | No |
| `/profile/settings` | Profile settings | Yes | No |
| `/leaderboard` | Rankings | No | No |
| `/clans` | Clan directory | Yes | No |
| `/clans/create` | Create clan | Yes | Yes |
| `/clans/:id` | Clan detail page | Yes | No |
| `/pricing` | Subscription pricing | No | No |
| `/messages` | Direct messages | Yes | Yes |
| `/admin/problems` | Problem CRUD + testing sandbox | Yes (admin) | No |
| `/admin/problems/new` | Create new problem | Yes (admin) | No |
| `/admin/problems/:id/test` | Test problem in sandbox | Yes (admin) | No |
| `/admin/review` | Review queue for contributed problems | Yes (admin/reviewer) | No |

---

## 🚧 In Progress

**Next up (queued after Subscription System shipped):**

1. **Friends UI (Phase 3.1)** — backend endpoints and real-time presence are
   complete; this delivers the biggest social-retention lift for the least
   client effort. Start with `friendsSlice` + friends list sidebar.
2. **Chat completion (Phase 3.2)** — backend (DMs, lobby/battle history) is
   complete and `BattleChat` is already wired in-battle. Finish history
   pagination, lobby chat, and direct-message threads.

Clan pages/challenges (3.3/3.4) and Push notifications (3.5) come after,
in that order. Avoid Battle Royale UI and Achievements until their server
TODOs close out.

---

## ✅ Practice Ground — COMPLETED

Non-competitive problem-solving mode. Free for everyone; stat tracking is a PRO perk.

### Completed:

- [x] `Practice.tsx` problem list page
  - Difficulty filter (All / Easy / Medium / Hard)
  - Topic tag multi-select filter
  - "Unsolved only" toggle
  - Solved checkmark (or 🔒 upgrade hint for FREE users)
  - Per-problem attempt counter
  - Hero stats tile (solved/total, total attempts, solve rate)
- [x] `PracticeSolve.tsx` solve view reusing battle components:
  - `ProblemPanel`, `CodeEditor`, `ConsolePanel` — no Timer, no OpponentProgress, no SkillBar, no BattleChat
  - Horizontal + vertical resizable splits
  - Run button (`POST /problems/:id/execute` — stdout sandbox)
  - Submit button (`POST /api/practice/attempts` — records for PRO)
  - Language switcher constrained to Python + JavaScript
  - FREE-tier upsell banner above the editor
  - Toast feedback on run/submit
- [x] TanStack Query hooks for `GET /practice/problems` and `GET /practice/stats`
- [x] `client/src/services/practice.ts` API helper + `client/src/types/practice.ts` types
- [x] Navbar link to `/practice` (between Dashboard and Play)
- [x] Practice Ground quick-action card on Dashboard

### Follow-ups:

- [ ] Profile tab: render `stats.practice` (topics-I-crush visualization, difficulty bars)
- [ ] Per-problem attempt history drawer in PracticeSolve

---

## ✅ Dev Authoring Preview + Harness Editing — COMPLETED

Dev-focused tooling to preview YAML-authored problems and safely edit only the function body.

### Completed:

- [x] Added dev routes: `/author` and `/author/problems/:slug`
- [x] Added `AuthorList.tsx` and `AuthorPreview.tsx` pages for YAML problem browsing + dry-run execution
- [x] Added shared starter parser (`client/src/lib/starterCode.ts`) to support both:
  - Legacy `{ lang: fullProgram }`
  - New `{ lang: { prefix, body, suffix } }`
- [x] Updated `CodeEditor` to expose/edit only `body` while preserving hidden IO harness server-side
- [x] Updated battle/practice flow to use parsed body starters consistently
- [x] Upgraded authoring model to v2 signature-based YAMLs (`signature`, `starter`, `tests`) while keeping v1 compatibility
- [x] Console panel now shows per-test debug `stdout` and `stderr` separately from graded answer output

### Follow-ups:

- [ ] Add discoverability link to author tools in dev builds only (instead of direct route entry)
- [ ] Add client tests for legacy/new starter-code parsing edge cases

---

## ✅ Phase 1: Foundation (MVP Core) — COMPLETED

**Goal:** User can sign up, see dashboard, and play a 1v1 game end-to-end.

### 1.1 Project Setup ✅
- [x] Initialize Vite + React + TypeScript project
- [x] Install and configure Tailwind CSS
- [x] Install and configure shadcn/ui (dark theme as default)
- [x] Set up React Router with all route definitions
- [x] Set up Redux Toolkit store with typed hooks (`useAppDispatch`, `useAppSelector`)
- [x] Set up TanStack Query provider
- [x] Set up Socket.IO client service
- [x] Set up Supabase client (auth only)
- [x] Set up Axios/fetch API client with auth interceptor (attach JWT to requests)
- [x] Configure environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL, VITE_SOCKET_URL)
- [ ] Set up Vitest for unit testing
- [x] Create base layout component (top navbar + main content area)
- [x] **Success Criteria:** App runs, routes work, API client configured ✅

### 1.2 Auth Flow ✅
- [x] Create `/login` page with GitHub + Google OAuth buttons
- [x] Configure Supabase OAuth providers (GitHub, Google)
- [x] Create `/auth/callback` page to handle OAuth redirect
- [x] On callback: extract JWT from Supabase session → call `POST /api/auth/sync` → store user in Redux
- [x] Create `authSlice` (user, token, isAuthenticated, isLoading)
- [x] Create `useAuth` hook (login, logout, getCurrentUser, isAuthenticated)
- [x] Add auth persistence (store token in localStorage, restore on app load)
- [x] Create `ProtectedRoute` wrapper component (redirect to `/login` if not auth'd)
- [ ] Create `AdminRoute` wrapper component (redirect if not admin role)
- [x] Add user avatar + dropdown to navbar (when logged in)
- [x] Add logout functionality
- [x] **Success Criteria:** User can sign up via GitHub/Google → synced to backend → stays logged in on refresh ✅

### 1.3 Landing Page ✅
- [x] Clean minimal hero section with tagline + CTA button ("Start Battling" → `/login` or `/dashboard`)
- [x] Brief feature highlights section (3-4 cards: battle, compete, climb ranks)
- [ ] Top 10 leaderboard preview (public, fetched from `GET /api/users?limit=10`)
- [x] Footer with links
- [x] Redirect logged-in users from `/` to `/dashboard`
- [x] Scroll-triggered fade/slide/scale animations using IntersectionObserver
- [x] Infinite marquee of supported languages
- [x] Rank tier showcase (7 tiers matching backend)
- [x] FAQ accordion
- [x] Stats banner (4 game modes, 7 languages, 7 rank tiers, 5 battle skills)
- [x] **Success Criteria:** Landing page looks clean, CTA works ✅

### 1.4 Dashboard Page ✅
- [x] Quick Play button (prominent, top of page → navigates to `/play`)
- [x] Stats overview card: MMR, rank badge (with icon + color via `RankBadge` component), W/L record
- [ ] Activity heatmap component (GitHub-style, placeholder data initially until backend supports it)
- [x] Recent activity feed (last 5 battles from `GET /api/users/:id/history`)
- [ ] Remaining free games badge (if free tier, shows "1 game remaining today" or "Pro ∞")
- [x] **Success Criteria:** Dashboard loads with real user data after login ✅

### 1.5 Matchmaking UI ✅
- [x] Create `matchmakingSlice` (queueStatus: idle/queued/matched, estimatedWait)
- [x] Create `useMatchmaking` hook (joinQueue, leaveQueue, checkStatus)
- [x] Queue screen: animated searching indicator, estimated wait, cancel button
- [x] On `matchmaking.match_found` WebSocket event → redirect to `/battle/:id`
- [ ] MMR range indicator (shows current search range)
- [x] Mode selection before queueing (via Play wizard)
- [x] Call `POST /api/matchmaking/queue` to join, `DELETE /api/matchmaking/queue` to leave
- [x] Config summary badges displayed while queuing (mode, difficulty, time limit, topic, skill count)
- [x] useRef guard prevents double-joining in React Strict Mode
- [x] **Success Criteria:** User can queue → wait → get matched → redirected to battle ✅

### 1.6 Battle View (1v1) ✅
- [x] Create `battleSlice` (battleId, status, problem, opponent, myProgress, opponentProgress, myCode, selectedLanguage, runResult, isRunning, usedSkills, activeEffects)
- [x] Create `useBattle` hook (submitCode, runCode, useSkill, readyUp, unready, getStatus, onBattleEvent)
- [x] Layout: resizable two-pane split (problem panel | editor + console) with drag handles
  - [x] useResizable hook with min/max fraction clamping (0.2–0.8)
  - [x] Horizontal drag handle between problem and editor
  - [x] Vertical drag handle between editor and console
- [x] Monaco Editor integration:
  - [x] Install `@monaco-editor/react`
  - [x] Language selector dropdown (Python, JavaScript, TypeScript, Java, C++, C, Rust)
  - [x] Load starter code per language from problem data
  - [x] Dark theme (vs-dark)
- [x] Problem description panel:
  - [x] Title, difficulty badge, description
  - [x] Visible test cases (input + expected output)
- [x] Console output panel (tabbed: Test Results + Output):
  - [x] Per-test pass/fail with input/expected/actual output
  - [x] Raw stdout/stderr from code execution
  - [x] Loading spinner during execution
  - [x] Summary header (X/Y tests passed)
- [x] Countdown timer at top center:
  - [x] Count down from `timeLimitMinutes`
  - [x] Color change when < 60s remaining (yellow), < 30s (red)
  - [x] Auto-complete battle when timer hits 0
- [x] Opponent progress bar:
  - [x] Show tests passed / total tests
  - [x] Listen to `battle.submission` WebSocket event for opponent updates
- [x] Run button (outline variant):
  - [x] Call `POST /problems/:id/execute` to test code without submitting
  - [x] Display results in console panel
- [x] Submit button:
  - [x] Call `POST /api/battles/:id/submit` with code + language
  - [x] Show loading state during submission
  - [x] Display test results in console panel
- [x] WebSocket integration:
  - [x] Join battle room on mount (`battle.join`)
  - [x] Listen: `battle.started`, `battle.submission`, `battle.completed`, `battle.player_joined`, `battle.player_ready`, `skill.effect`, `skill.used`
  - [x] Leave room on unmount (`battle.leave`)
- [x] Handle battle states: WAITING (show BattleLobby), IN_PROGRESS (play), COMPLETED (redirect to results)
- [x] **Success Criteria:** Full 1v1 battle playable: see problem → write code → run/submit → see results → battle ends ✅

### 1.7 Post-Battle Results (Partial)
- [x] Basic results page exists (`Results.tsx`)
- [ ] Winner/loser announcement with visual distinction
- [ ] MMR change display (number going up for winner, down for loser)
- [ ] Stats summary: time taken, tests passed, language used
- [ ] Both players' code side by side (read-only Monaco editors)
- [ ] Rematch button (creates new battle with same opponent, redirects)
- [x] Return to dashboard button
- [ ] **Success Criteria:** Results screen shows all battle data, navigation back to dashboard works ✅

### 1.8 Basic Profile Page
- [ ] Fetch user data from `GET /api/users/:username` or `GET /api/users/:id`
- [ ] Display: avatar, username, MMR, rank badge (name + icon + color), W/L record
- [ ] Match history list (last 20, paginated) from `GET /api/users/:id/history`
- [ ] If viewing own profile, show "Edit Profile" button → `/profile/settings`
- [ ] Profile settings page: update username, avatar URL
  - [ ] Call `PATCH /api/users/:id` to save changes
- [ ] **Success Criteria:** Profile page shows real user data, editable for own profile ✅

---

## 📋 Phase 2: Monetization & Game Polish

**Goal:** Subscription gating, skills system, satisfying win celebrations, invites.
**Depends on backend:** Subscription module, Skills module, Invite module.

### 2.1 Subscription System ✅
- [x] Create `subscriptionSlice` (tier free/pro/trial, gamesRemaining, gamesPlayedToday, resetsAt, source)
- [x] Create `useSubscription` hook (isPro, isDev, canPlay, refresh)
- [x] Create `usePaywall` hook (requireCanPlay, guard)
- [x] Pricing page (`/pricing`):
  - [x] Plan cards: $5 / 2 months + yearly option
  - [x] Feature comparison (free vs pro)
  - [x] "Upgrade" buttons → `POST /api/subscriptions/checkout` → Stripe hosted checkout redirect
  - [x] Handle return from Stripe (`?checkout=success|cancel`) with toast + status refresh
  - [x] "Manage Billing" button for active Pro users → `POST /api/subscriptions/portal`
- [x] Paywall prompt via sonner toast (actionable "Upgrade" CTA → `/pricing`)
  - Uses toast instead of a modal to match the existing design language; same
    copy hooks + CTA as a modal without introducing a new Dialog primitive.
- [x] Games remaining badge in navbar:
  - [x] Free users: "N free game(s) today" → amber "0 today · Upgrade" when out
  - [x] Pro users: "PRO ∞" pill
  - [x] Trial users: "TRIAL ∞" pill
  - [x] Dev-allowlist users: "DEV PRO ∞" pill (surfaces server `source === 'dev'`)
- [x] Gate check on:
  - [x] `/play` → Find Match, Create Private, Join by Code
  - [x] Dashboard Quick Match (hero + quick-action card)
  - [x] Matchmaking queue join (`useMatchmaking.joinQueue` defensive gate)
  - [x] Joining a battle via `/invite/:code` and in-app invite toast
- [x] Fetch subscription status on login from `GET /api/subscriptions/status`
  - Mounted in `RootLayout` via `useSubscription`; refreshed after each
    successful gameplay-initiating action.
- [x] Dev bypass: server reads `DEV_PRO_USER_IDS` / `DEV_PRO_EMAILS` and
  short-circuits `canPlay` + reports `source: 'dev'` in `getSubscriptionStatus`
  so developer accounts are unaffected by the free daily limit without
  touching Stripe. Covered by unit tests in `subscriptions.service.spec.ts`.
- [x] **Success Criteria:** Free user blocked after 1 game → upgrade toast shown → can subscribe → unlimited games ✅

#### Follow-ups (non-blocking)
- [ ] Replace the sonner "out of free games" toast with a dedicated modal
  once a shared Dialog primitive lands in `components/ui/`.
- [ ] Surface the subscription status on the Profile page when that page
  lands.
- [ ] Quick Play preset (`/play/quick`) should share the same gate flow.

### 2.2 Skills System UI ✅
- [x] Skill bar component (`SkillBar.tsx`) displayed during battle:
  - [x] 4 skill buttons: Freeze ❄️, Scramble 🔀, Time Steal ⏰, Fog 🌫️
  - [x] Greyed out / disabled after use (single-use per battle via `usedSkills` state)
  - [x] Locked state shown until player passes at least 1 test case
  - [x] Click to activate → emit `skill.use` WebSocket event
  - [x] Only visible if skills are enabled for this battle
- [x] Skill visual effects (`SkillEffectOverlay.tsx`) when opponent uses skill on you:
  - [x] **Freeze**: Blue overlay with ❄️ icon + "FROZEN!" text + countdown
  - [x] **Scramble**: Editor text scramble effect with no undo recovery
  - [x] **Time Steal**: Red flash overlay + server-driven timer sync (`battle.time_updated`)
  - [x] **Fog of War**: Pulsing blur overlay (no center badge to increase disruption)
- [ ] Skill notification toast: "🐒 CodeMonkey used Freeze on you!" with opponent's username
- [x] WebSocket events:
  - [x] Emit `skill.use` when activating a skill: `{ battleId, targetUserId, skillType }`
  - [x] Listen `skill.effect` for incoming skill effects: `{ skillType, fromUserId, duration }`
  - [x] Listen `skill.used` for room-wide broadcast
  - [x] Listen `battle.time_updated` to update countdown after Time Steal
- [x] Skill selection in game creation wizard (Step 3 in Play.tsx):
  - [x] Checklist of available skills, toggle each ON/OFF
  - [x] "Enable All" / "Disable All" buttons
  - [x] Default: all disabled (no skills)
  - [x] Skill descriptions on hover
- [x] **Success Criteria:** Skills work in-battle: use on opponent → they see effect → skill greys out ✅

### 2.3 Win Celebrations
- [ ] Install confetti library (e.g., `canvas-confetti` or `react-confetti`)
- [ ] Install animation library (e.g., `framer-motion`)
- [ ] Winner celebration sequence on results page:
  1. [ ] Confetti burst animation (3-5 seconds)
  2. [ ] MMR counter animation: old MMR → new MMR counting up digit by digit
  3. [ ] Opponent's MMR counter going down
  4. [ ] Win streak counter displayed (if streak > 1): "🔥 3 Win Streak!"
  5. [ ] Rank badge animation: if rank changed, old badge → flash → new badge with glow
  6. [ ] Sound fanfare (victory jingle, ~3 seconds)
- [ ] Loser screen: muted colors, MMR going down, "Better luck next time" message
- [ ] Stats summary card with animation (tests passed, time taken, language)
- [ ] **Success Criteria:** Winning feels satisfying — confetti, numbers counting up, rank glow, sound ✅

### 2.4 Game Creation Wizard ✅
- [x] Step 1: **Mode Selection**
  - [x] 1v1 card
  - [x] Battle Royale card (with player count selector: 6 or 8)
  - [x] Visual cards with icons and descriptions
- [x] Step 2: **Settings**
  - [x] Number of problems selector (1, 2, 3, 5) with MMR stakes preview
  - [x] Time limit selector (5, 10, 15, 20, 30 min)
  - [x] Difficulty preference (Any, Easy, Medium, Hard)
  - [x] Topic/tag filter
- [x] Step 3: **Skills Configuration**
  - [x] Toggle each skill ON/OFF (Freeze, Scramble, Blind, Time Steal, Fog of War)
  - [x] Enable All / Disable All buttons
  - [x] Default: all off
  - [x] Skill descriptions on hover
- [x] Step 4: **Invite**
  - [x] Option A: "Find Match" → join matchmaking queue with these settings
  - [x] Option B: "Create Private Game" → generate invite code
  - [ ] Option C: "Invite Player" → search by username, send in-app invite
  - [x] Shareable invite code with copy button
  - [ ] QR code for invite link (nice-to-have)
- [ ] **Save Preset**: save current settings as named preset (stored in localStorage)
- [x] Step progress indicator (dots at top)
- [x] Back/Next navigation between steps
- [x] **Success Criteria:** Full wizard creates game with all settings, invite code generated ✅

### 2.5 Quick Play
- [ ] `/play/quick` route
- [ ] Load saved preset from localStorage (or use defaults: 1v1, 5 min, Medium, no skills)
- [ ] Show preset summary → "Play Now" button
- [ ] Manage presets (list, rename, delete saved presets)
- [ ] **Success Criteria:** One-click play from dashboard using saved settings ✅

### 2.6 Direct Invites ✅
- [x] Invite code flow: creator gets code → opponent enters code → joins battle
- [x] BattleLobby component with ready-up flow (both players ready → battle starts)
- [x] Invite notification hook (`useInviteNotifications.ts`) — listens for battle invites via WebSocket
- [x] Invite link page (`/invite/:code`, `InviteJoin.tsx`):
  - [x] Fetch battle info from `GET /api/battles/invite/:code`
  - [x] Show game settings (mode, skills, creator username, expiry)
  - [x] "Join Battle" button → calls `POST /api/battles/invite/:code/join`
  - [x] If not logged in → stores pending invite in sessionStorage, sends user to login, returns to `/invite/:code` after OAuth callback
  - [x] Handle invalid (404) / expired/started (400) invite codes with friendly messaging
- [x] In-app invite:
  - [x] Username input (send invite from `BattleLobby` → `POST /api/battles/:id/invite-user`)
  - [x] Send invite → WebSocket `battle.invite_received` to target
  - [x] Target sees toast notification with "Accept" / "Decline" actions
- [x] Invite notification component (sonner toast):
  - [x] "PlayerX invited you to a 1v1 battle!"
  - [x] Accept → `POST /api/battles/invite/:code/join` → redirect to `/battle/:id`
  - [x] Decline → dismiss toast
- [ ] Nice-to-haves (deferred):
  - [ ] Username search autocomplete in invite-by-username input
  - [ ] Mutual friends / profile preview on invite link page
- [x] **Success Criteria:** Both link and in-app invites work, target can accept/decline ✅

### 2.7 Sound System
- [ ] Create `SoundManager` utility (preload audio files, play, stop, volume control)
- [ ] Sound effects:
  - [ ] Battle start: countdown beep (3, 2, 1, GO)
  - [ ] Skill activation: whoosh/impact sound per skill type
  - [ ] Test case passed: subtle ding
  - [ ] Code submitted: submit sound
  - [ ] Battle won: victory fanfare
  - [ ] Battle lost: defeat sound
  - [ ] Timer low (< 30s): ticking sound
  - [ ] Rank up: special rank-up jingle
- [ ] Global mute toggle in navbar (icon: 🔊/🔇)
- [ ] Store mute preference in localStorage
- [ ] Volume slider in profile settings
- [ ] **Success Criteria:** Sounds play at appropriate moments, mute toggle works ✅

---

## 📋 Phase 3: Social & Communication

**Goal:** Friends, chat, clans, notifications.
**Depends on backend:** Friends module, Chat module, Clan challenge module, Push notification module.

### 3.1 Friends System
- [ ] Create `friendsSlice` (friends, pendingRequests, sentRequests)
- [ ] Create `useFriends` hook (sendRequest, acceptRequest, declineRequest, removeFriend, getFriends)
- [ ] Friends list component (sidebar or dedicated section):
  - [ ] List friends with avatar, username, online status dot (green/gray)
  - [ ] "Add Friend" button → username search input
  - [ ] Right-click or action menu: invite to game, send message, remove friend
- [ ] Pending requests section:
  - [ ] Incoming requests with Accept/Decline buttons
  - [ ] Sent requests with "Pending..." status
- [ ] Online presence:
  - [ ] Listen to `presence.online` / `presence.offline` WebSocket events
  - [ ] Update friend status in real-time
- [ ] Friends list accessible from navbar (icon with pending count badge)
- [ ] **Success Criteria:** Can add friends, see online status, accept/decline requests ✅

### 3.2 Chat System
- [ ] Create `chatSlice` (activeRoom, messages, conversations)
- [ ] Create `useChat` hook (sendMessage, joinRoom, leaveRoom, getHistory)
- [ ] Chat components:
  - [ ] `ChatPanel` — collapsible panel for in-game/lobby chat
  - [ ] `ChatMessage` — single message (avatar, username, text, timestamp)
  - [ ] `ChatInput` — text input with send button (Enter to send)
  - [ ] `ChatWindow` — full page chat for DMs (`/messages`)
- [ ] Battle chat:
  - [x] Chat panel on battle page (floating, collapsible `BattleChat`)
  - [x] Auto-join battle chat room on battle start (`useBattleChat` + `chat.join_room`)
  - [x] Send/receive real-time messages in battle room (`chat.send`, `chat.message`)
  - [ ] Chat history loads from `GET /api/chat/battle/:battleId`
- [ ] Post-game chat:
  - [ ] Chat persists on results page
  - [ ] GG / rematch conversation
- [ ] Lobby chat:
  - [ ] Global chat room on dashboard
  - [ ] Visible to all logged-in users
  - [ ] Auto-join on dashboard mount
- [ ] Direct Messages (`/messages`):
  - [ ] Conversation list (sorted by most recent)
  - [ ] Click conversation → show message thread
  - [ ] "New Message" → search username → start conversation
  - [ ] Unread message count badge in navbar
- [ ] Socket.IO events:
  - [ ] Emit `chat.send`: `{ roomType, roomId, content }`
  - [ ] Listen `chat.message`: `{ senderId, username, content, timestamp }`
  - [ ] Emit `chat.join_room` / `chat.leave_room`
- [ ] **Success Criteria:** Can chat in-game, in lobby, and via DMs in real-time ✅

### 3.3 Clan Pages
- [ ] Clan directory (`/clans`):
  - [ ] List all clans (sorted by MMR)
  - [ ] Search by clan name or tag
  - [ ] "Create Clan" button (→ `/clans/create`)
  - [ ] Pagination
- [ ] Create clan page (`/clans/create`):
  - [ ] Form: name, tag (3-5 chars), banner/logo upload or selection
  - [ ] Call `POST /api/clans`
- [ ] Clan detail page (`/clans/:id`):
  - [ ] Clan banner/logo + name + tag
  - [ ] Clan MMR + leaderboard rank
  - [ ] Member list with roles (Owner, Member)
  - [ ] Clan battle history (list of clan vs clan battles)
  - [ ] Join/Leave button (if not a member / if a member)
  - [ ] Kick member button (owner only)
  - [ ] Clan chat section (Socket.IO room `clan:{clanId}`)
  - [ ] "Challenge Another Clan" button (owner only)
- [ ] Join request / invite system:
  - [ ] Open clans: "Join" button
  - [ ] Invite-only clans: "Request to Join" → pending review by owner
- [ ] **Success Criteria:** Can browse, create, join, and manage clans ✅

### 3.4 Clan Wars (Challenges)
- [ ] Send challenge:
  - [ ] From clan page: "Challenge" button on another clan's page
  - [ ] Select game settings (mode, team size, skills, time limit)
  - [ ] Send challenge → `POST /api/clans/:id/challenge`
- [ ] Receive challenge:
  - [ ] Notification: "Clan [X] has challenged your clan!"
  - [ ] View challenge details (game settings, challenger clan stats)
  - [ ] Accept → creates CLAN_VS_CLAN battle → redirects clan members to lobby
  - [ ] Decline → notification to challenger
- [ ] Challenges list on clan page:
  - [ ] Pending incoming and outgoing challenges
  - [ ] Challenge history
- [ ] **Success Criteria:** Can send clan challenge → accept → play clan war ✅

### 3.5 Push Notifications
- [ ] Request browser notification permission on login
- [ ] Register push subscription with `POST /api/notifications/subscribe`
- [ ] Handle push events:
  - [ ] Match found → "Your match is ready! Click to play"
  - [ ] Battle invite received → "PlayerX invited you to battle!"
  - [ ] Friend request → "PlayerX sent you a friend request"
  - [ ] Clan challenge → "Clan [X] challenged your clan!"
- [ ] Notification click → navigate to relevant page
- [ ] Unsubscribe on logout
- [ ] **Success Criteria:** Push notifications appear when app is in background ✅

---

## 📋 Phase 4: Battle Royale & Content

**Goal:** Full Battle Royale mode, problem contributions, achievements, full leaderboard.
**Depends on backend:** BR elimination module, Achievements module, Problem import pipeline.

### 4.1 Battle Royale UI
- [ ] Pre-game lobby:
  - [ ] Show all joined players (avatars, usernames, MMR, rank)
  - [ ] Player count: "4/6 players joined"
  - [ ] Creator can start early or wait for full lobby
  - [ ] Chat in lobby
- [ ] Round system:
  - [ ] Round indicator: "Round 1 of 3"
  - [ ] Problem loads at round start
  - [ ] Code editor + submit (same as 1v1)
  - [ ] Live standings board (who passed how many tests, sorted by progress)
  - [ ] Round timer
- [ ] Elimination between rounds:
  - [ ] Round end screen: standings + eliminated players highlighted in red
  - [ ] "X players eliminated" announcement
  - [ ] Transition animation to next round (3-second countdown)
  - [ ] Eliminated players become spectators (view-only mode)
- [ ] Final round:
  - [ ] "FINAL ROUND" banner
  - [ ] 2 players remaining
  - [ ] Standard 1v1 format
  - [ ] Full win celebration for champion
- [ ] Overall standings at end:
  - [ ] 1st, 2nd, 3rd place with podium-style display
  - [ ] MMR changes for all players
  - [ ] Round-by-round breakdown
- [ ] WebSocket events:
  - [ ] Listen `battle.round_start`, `battle.round_end`, `battle.elimination`, `battle.royale_standings`
- [ ] **Success Criteria:** Full 6-8 player BR plays through all elimination rounds to winner ✅

### 4.2 Problem Contribution & Admin
- [ ] Admin problem management page (`/admin/problems`):
  - [ ] List all problems with status (ACTIVE, DRAFT, REJECTED)
  - [ ] Search + filter by difficulty, status, tags
  - [ ] Create / Edit / Delete buttons
- [ ] Problem creation form (`/admin/problems/new`):
  - [ ] Fields: title, description (markdown editor), difficulty, tags, constraints, expected complexity, hints
  - [ ] Test cases editor: add/remove input/output pairs, toggle hidden
  - [ ] Starter code editors: one Monaco editor per language (tabs)
  - [ ] Editorial/solution editor (markdown + code)
  - [ ] Save as DRAFT or publish as ACTIVE
- [ ] Problem testing sandbox (`/admin/problems/:id/test`):
  - [ ] Full Monaco editor
  - [ ] Language selector
  - [ ] "Run Tests" button → calls `POST /api/problems/:id/execute`
  - [ ] Shows test results (passed/failed per test case, output vs expected)
  - [ ] Ability to test with ALL test cases (including hidden)
  - [ ] Verify problem is solvable before publishing
- [ ] Community review queue (`/admin/review`):
  - [ ] List of problems in DRAFT status submitted by community
  - [ ] Review interface: see problem + test cases + starter code
  - [ ] "Test in Sandbox" button
  - [ ] "Approve" / "Reject with reason" buttons
  - [ ] Contributor attribution
- [ ] Documentation page for contributors:
  - [ ] How to structure a problem folder
  - [ ] Required fields and format
  - [ ] Example problem folder structure
  - [ ] Link to `/problems` directory in repo
- [ ] **Success Criteria:** Admin can create, test, and publish problems; community problems can be reviewed ✅

### 4.3 Achievements System
- [ ] Achievements grid on profile page:
  - [ ] All achievements displayed as cards/badges
  - [ ] Unlocked: full color with unlock date
  - [ ] Locked: greyed out with description of how to unlock
  - [ ] Progress indicators where applicable (e.g., "7/10 Python wins")
- [ ] Achievement unlock notification:
  - [ ] In-game toast: "🏆 Achievement Unlocked: Speed Demon!"
  - [ ] Animation: badge appears with glow/shine effect
  - [ ] Sound effect for unlock
- [ ] Achievement definitions:
  | Achievement | Description |
  |-------------|-------------|
  | First Blood | Win your first battle |
  | On Fire (5) | Win 5 battles in a row |
  | Unstoppable (10) | Win 10 battles in a row |
  | Legendary (25) | Win 25 battles in a row |
  | Speed Demon | Solve a problem in under 2 minutes |
  | Comeback King | Win after opponent passed more tests first |
  | Pythonista | Win 10 battles using Python |
  | JS Wizard | Win 10 battles using JavaScript |
  | Clan Champion | Win 10 clan wars |
  | Problem Setter | Contribute a problem that gets approved |
  | Seasonal Glory | Finish a season in top 100 |
- [ ] Listen to `achievement.unlocked` WebSocket event
- [ ] **Success Criteria:** Achievements show on profile, unlock notification fires ✅

### 4.4 Full Leaderboard Page
- [ ] Tab navigation: Global | Friends | Clans
- [ ] Global tab:
  - [ ] Ranked list: position, avatar, username, MMR, rank badge, W/L, win rate
  - [ ] Pagination (50 per page)
  - [ ] Time filter: Daily / Weekly / Monthly / All-Time
  - [ ] Language filter dropdown
  - [ ] Highlight current user's row
  - [ ] Top 3 with special styling (gold, silver, bronze)
- [ ] Friends tab:
  - [ ] Same format but only friends + current user
  - [ ] Requires friends system
- [ ] Clans tab:
  - [ ] Clan name, tag, MMR, member count, W/L
  - [ ] Click clan → `/clans/:id`
- [ ] Search by username in all tabs
- [ ] **Success Criteria:** Leaderboard loads with all filters working ✅

### 4.5 Profile Enhancements
- [ ] Activity heatmap (GitHub-style):
  - [ ] 365-day grid showing games played per day
  - [ ] Color intensity based on activity level
  - [ ] Tooltip on hover: "5 games on April 15, 2026"
  - [ ] Data from `GET /api/users/:id/activity?year=2026`
- [ ] Match history:
  - [ ] Paginated list of all battles
  - [ ] Each entry: opponent, result (W/L), MMR change, problem title, language, date
  - [ ] Click to expand: see code, test results
  - [ ] Filter by mode, result, date range
- [ ] Favorite language stats:
  - [ ] Pie chart or bar chart of games played per language
  - [ ] Win rate per language
- [ ] Customizable avatar/banner:
  - [ ] Upload avatar image or use Gravatar
  - [ ] Select banner color/image
  - [ ] Preview before saving
- [ ] Clan info section (if in a clan):
  - [ ] Clan name, tag, role
  - [ ] Link to clan page
- [ ] Friends list section:
  - [ ] Mutual friends (if viewing someone else's profile)
  - [ ] "Add Friend" button
- [ ] **Success Criteria:** Full profile with heatmap, history, stats, customization ✅

---

## 📋 Phase 5: Polish & Share

**Goal:** Shareable results, final UX polish.
**Depends on backend:** Share image module.

### 5.1 Share System
- [ ] Auto-generated result image card:
  - [ ] Canvas-based or server-generated image
  - [ ] Shows: winner name + rank badge, loser name + rank badge, MMR changes, problem title, time taken
  - [ ] CodeQuest branding/watermark
  - [ ] Dark theme matching the app
- [ ] Pre-written trash talk captions (randomized pool):
  - [ ] "Get rekt. [Winner] just destroyed [Loser] in [Time]. Not even close 💀"
  - [ ] "[Winner] said 'hold my keyboard' and finished in [Time] ⚡"
  - [ ] "Another day, another victim. [Winner] climbs to [Rank] 🏔️"
  - [ ] "[Loser] thought they were him. They were not. [Winner] wins again 🐒"
  - [ ] Allow user to edit caption before sharing
- [ ] Share buttons:
  - [ ] Twitter/X: open share intent with image + caption
  - [ ] Discord: copy image + caption
  - [ ] Copy link to public results page
  - [ ] Download image
  - [ ] Instagram Story format (9:16 aspect ratio option)
- [ ] Public results page (`/battle/:id/results/share`):
  - [ ] No auth required
  - [ ] OG meta tags for social media preview (title, description, image)
  - [ ] Battle summary (winner, MMR, problem, time)
  - [ ] "Play CodeQuest" CTA for non-users
- [ ] **Success Criteria:** Share card generates, looks good on Twitter/Discord, link has OG preview ✅

### 5.2 Quick Play Presets
- [ ] Preset manager (accessible from dashboard or `/play`):
  - [ ] List saved presets (name, settings summary)
  - [ ] "Play" button per preset (instant queue with those settings)
  - [ ] Edit preset name
  - [ ] Delete preset
- [ ] Default preset: "Quick 1v1" (1v1, 1 problem, 5 min, any difficulty, no skills)
- [ ] Store presets in localStorage (sync to backend later)
- [ ] **Success Criteria:** Can save, load, and play from presets ✅

### 5.3 Rank Display Polish
- [ ] Rank badges with custom icons (not emoji — designed SVGs or icons):
  | Rank | Icon | Color | Border |
  |------|------|-------|--------|
  | Bug | Bug icon | `#22c55e` Green | — |
  | Intern | Paperclip icon | `#9ca3af` Gray | — |
  | Copy Paster | Clipboard icon | `#cd7f32` Bronze | Bronze border |
  | Stack Overflow Andy | Search icon | `#c0c0c0` Silver | Silver border |
  | Code Monkey | Monkey icon | `#ffd700` Gold | Gold border |
  | 10x Dev | Lightning bolt | `#3b82f6` Diamond Blue | Blue glow |
  | Cracked | Skull icon | `#ef4444` Red | Red animated glow |
- [ ] Rank badge component (reusable): shows icon + name + color
- [ ] Rank-up animation: old badge shrinks → flash → new badge grows with particles
- [ ] Rank displayed: navbar, profile, leaderboard, battle results, match history
- [ ] **Success Criteria:** Ranks look polished with custom icons and animations ✅

### 5.4 UI/UX Polish
- [ ] Loading skeletons for all data-fetching pages
- [ ] Error boundary components with retry buttons
- [ ] Empty states for: no match history, no friends, no clan, etc.
- [ ] Toast notification system for success/error messages
- [ ] Smooth page transitions (fade/slide)
- [ ] Keyboard shortcuts:
  - [ ] `Ctrl+Enter` to submit code in battle
  - [ ] `Escape` to close modals
- [ ] Responsive navbar (collapse to hamburger if very narrow desktop)
- [ ] 404 page
- [ ] **Success Criteria:** No raw loading states, no ugly errors, everything smooth ✅

### 5.5 E2E Tests (Playwright)
- [ ] Test: Sign up with GitHub → lands on dashboard
- [ ] Test: Find match → play 1v1 → submit code → see results
- [ ] Test: Free user plays 1 game → blocked on 2nd → subscribe → play again
- [ ] Test: Create game with invite link → friend joins via link → battle starts
- [ ] Test: Battle Royale full flow (6 players, 3 rounds, elimination, winner)
- [ ] Test: Add friend → online status shows → chat works
- [ ] Test: Create clan → join → send challenge → accept → play war
- [ ] Test: Share result → image generates → public page loads
- [ ] **Success Criteria:** All E2E tests pass ✅

---

## 🧪 Testing Requirements

### Unit Tests (Vitest)
- [ ] All Redux slices (authSlice, battleSlice, matchmakingSlice, subscriptionSlice, skillsSlice, friendsSlice, chatSlice)
- [ ] All custom hooks (useAuth, useBattle, useMatchmaking, useSubscription, useSkills, useFriends, useChat)
- [ ] Utility functions (formatters, validators, rank tier calculator, sound manager)
- [ ] API client (request/response handling, auth interceptor)

### Component Tests (React Testing Library)
- [ ] Auth flow (login redirect, callback handling)
- [ ] Battle view (problem display, code submission, timer, opponent progress)
- [ ] Skill bar (activation, disable after use, effect rendering)
- [ ] Paywall modal (shows for free users, not for pro)
- [ ] Game creation wizard (step navigation, validation)
- [ ] Chat (send/receive messages)
- [ ] Leaderboard (filters, pagination)

### E2E Tests (Playwright)
- [ ] See Phase 5.5 above

---

## 📂 Project Structure

```
client/
├── public/
│   ├── sounds/              # Sound effect files
│   └── images/              # Static images, rank icons
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (Button, Input, Modal, Card, etc.)
│   │   ├── layout/          # Navbar, Footer, ProtectedRoute, AdminRoute
│   │   ├── battle/          # BattleView, SkillBar, OpponentProgress, Timer, ProblemPanel
│   │   ├── editor/          # MonacoEditor wrapper, skill effects (freeze overlay, fog blur)
│   │   ├── chat/            # ChatPanel, ChatMessage, ChatInput, ChatWindow
│   │   ├── social/          # FriendsList, FriendRequest, OnlineStatus
│   │   ├── matchmaking/     # QueueStatus, MatchFound
│   │   ├── subscription/    # PaywallModal, PricingCard, GamesRemainingBadge
│   │   ├── profile/         # Heatmap, MatchHistory, AchievementGrid, RankBadge
│   │   ├── clan/            # ClanCard, ClanMemberList, ClanChat, ChallengeModal
│   │   ├── leaderboard/     # LeaderboardTable, LeaderboardFilters
│   │   ├── admin/           # ProblemForm, TestCaseEditor, StarterCodeEditor, ReviewQueue
│   │   └── share/           # ShareCard, ShareModal, TrashTalkCaption
│   │
│   ├── pages/
│   │   ├── Landing/         # Landing page
│   │   ├── Login/           # OAuth login
│   │   ├── AuthCallback/    # OAuth callback
│   │   ├── Dashboard/       # Main dashboard
│   │   ├── Play/            # Game creation wizard
│   │   ├── QuickPlay/       # Quick play from preset
│   │   ├── Battle/          # Active battle view
│   │   ├── BattleResults/   # Post-battle results
│   │   ├── ShareResults/    # Public shareable results
│   │   ├── InviteHandler/   # Invite link handler
│   │   ├── Matchmaking/     # Queue status
│   │   ├── Profile/         # Player profile
│   │   ├── ProfileSettings/ # Profile settings
│   │   ├── Leaderboard/     # Rankings
│   │   ├── Clans/           # Clan directory
│   │   ├── ClanCreate/      # Create clan
│   │   ├── ClanDetail/      # Clan detail page
│   │   ├── Pricing/         # Subscription pricing
│   │   ├── Messages/        # DM conversations
│   │   ├── AdminProblems/   # Admin problem management
│   │   ├── AdminProblemNew/  # Create/edit problem
│   │   ├── AdminProblemTest/ # Problem testing sandbox
│   │   └── AdminReview/     # Community problem review
│   │
│   ├── store/
│   │   ├── index.ts         # Store configuration
│   │   ├── hooks.ts         # Typed useAppDispatch, useAppSelector
│   │   └── slices/
│   │       ├── authSlice.ts
│   │       ├── battleSlice.ts
│   │       ├── matchmakingSlice.ts
│   │       ├── subscriptionSlice.ts
│   │       ├── skillsSlice.ts
│   │       ├── friendsSlice.ts
│   │       ├── chatSlice.ts
│   │       └── uiSlice.ts
│   │
│   ├── services/
│   │   ├── api.ts           # REST API client (Axios + auth interceptor)
│   │   ├── socket.ts        # Socket.IO client singleton
│   │   ├── supabase.ts      # Supabase auth client
│   │   └── sounds.ts        # SoundManager utility
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useBattle.ts
│   │   ├── useMatchmaking.ts
│   │   ├── useSubscription.ts
│   │   ├── useSkills.ts
│   │   ├── useFriends.ts
│   │   ├── useChat.ts
│   │   └── useSocket.ts
│   │
│   ├── types/
│   │   ├── api.ts           # API response/request types
│   │   ├── battle.ts        # Battle, BattleParticipant, BattleRound
│   │   ├── user.ts          # User, Profile, RankTier
│   │   ├── socket.ts        # Socket event types
│   │   ├── skill.ts         # SkillType, SkillEffect
│   │   ├── clan.ts          # Clan, ClanChallenge
│   │   ├── chat.ts          # Message, Conversation
│   │   └── subscription.ts  # Subscription, Plan
│   │
│   ├── utils/
│   │   ├── formatters.ts    # Date, time, MMR formatters
│   │   ├── validators.ts    # Form validation
│   │   ├── constants.ts     # App constants, rank tiers, skill definitions
│   │   └── rank.ts          # getRankTier(mmr) utility
│   │
│   ├── App.tsx              # Root with providers (Redux, Router, QueryClient, Socket)
│   ├── main.tsx             # Entry point
│   └── vite-env.d.ts        # Vite type declarations
│
├── e2e/                     # Playwright E2E tests
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
├── postcss.config.js
└── .env.example
```

---

## 🎯 Success Criteria (Overall)

### Phase 1: Foundation ⏳
- [ ] Project scaffold running
- [ ] Auth flow working (GitHub + Google → synced to backend)
- [ ] Landing page + Dashboard working
- [ ] 1v1 battle playable end-to-end
- [ ] Basic profile page showing real data

### Phase 2: Monetization & Polish ⏳
- [ ] Subscription gating works (paywall after 1 free game/day)
- [ ] Skills system works in-battle (5 skills, visual effects)
- [ ] Win celebrations feel satisfying (confetti, MMR animation, sound)
- [ ] Game creation wizard works with presets
- [x] Direct invites work (link + in-app)
- [ ] Sound effects working with mute toggle

### Phase 3: Social ⏳
- [ ] Friends system works (add, online status, invite)
- [ ] Chat works everywhere (battle, lobby, DM)
- [ ] Clan pages fully functional
- [ ] Clan challenges work
- [ ] Push notifications delivered

### Phase 4: Battle Royale & Content ⏳
- [ ] Battle Royale plays 3 elimination rounds with winner
- [ ] Admin can create + test problems in sandbox
- [ ] Community problem review queue works
- [ ] Achievements display + unlock correctly
- [ ] Full leaderboard with all filters

### Phase 5: Polish & Ship ⏳
- [ ] Share result cards generate + share to social media
- [ ] All rank badges polished with icons + animations
- [ ] UI/UX complete (loading states, errors, empty states)
- [ ] E2E tests passing
- [ ] Ready for users

---

## 🧹 Refactor Backlog

Living checklist of client-side cleanup. Order is roughly by impact. Tick items off as they ship.

**Paused (May 2026):** Refactor rollout stopped mid-P1/P2 — see unchecked items below. Next session: finish P1 shells, then execute P2 data layer moves.

### P0 — Lint baseline ✅ (done)

- [x] `npm run lint` reaches zero errors / warnings
- [x] Fix `react-hooks/set-state-in-effect`:
  - [x] `components/battle/BattleChat.tsx`
  - [x] `hooks/useLobbyPresence.ts`
  - [x] `pages/author/AuthorPreview.tsx`
  - [x] `pages/battle/Battle.tsx` (code seeding + scramble effect handling)
  - [x] `pages/battle/Play.tsx` (BR/CW presets via TanStack Query, not synchronous effect setState)
  - [x] `pages/clan/Clan.tsx`
  - [x] `pages/practice/PracticeSolve.tsx`
- [x] Fix `react-hooks/purity` (`Date.now` in render):
  - [x] `components/battle/SkillEffectOverlay.tsx`
  - [x] `pages/battle/Battle.tsx`
- [x] Fix `react-hooks/refs` — shared `hooks/useResizable.ts` exposes `fraction` + `containerProps` / `dragHandleProps`; used in Battle + PracticeSolve
- [x] Fix `react-refresh/only-export-components`:
  - [x] `components/ui/badgeVariants.ts` + slim `badge.tsx`
  - [x] `components/ui/buttonVariants.ts` + slim `button.tsx`
- [x] Replace `(p as any).user` in `components/battle/BattleLobby.tsx` with typed `p.user?.username`
- [x] Misc: `prefer-const` in `utils/stats.ts`

### P1 — Split mega page components (partial)

- [x] `pages/battle/Play.tsx` — extracted to **`pages/battle/play/`**: `usePlayConfig.ts`, `constants.ts`, `utils.ts`, and `components/{ModeSelector,RulesPanel,SkillsPicker,BattleRoyalePanel,ClanWarPanel,InvitePanel,...}.tsx`; shell **`Play.tsx`** is now thin (~110 lines).
  - [ ] **Deferred to P2:** move clan-wars / invite **`api.post`** from `InvitePanel` into **`services/battles.ts`** (currently still direct `api` calls in the panel).
- [x] **`pages/author/AuthorNew.tsx`** — extracted to **`pages/author/new/`**: `useAuthorForm.ts`, `utils.ts` (validation + YAML serialization), and `components/{MetaSection,StarterSection,TestsSection,HintsSection,SolutionSection,...}.tsx`; shell **`AuthorNew.tsx`** is now thin (~112 lines).
  - [x] `pages/author/new/useAuthorForm.ts`
  - [x] `pages/author/new/utils.ts` (validation + YAML serialization)
  - [x] `pages/author/new/components/{MetaSection,StarterSection,TestsSection,HintsSection,SolutionSection}.tsx`
- [ ] **`pages/dashboard/Dashboard.tsx`** (~780 lines after partial split; target <~400 lines)
  - [x] Extracted: `Heatmap`, `MatchRow`, `NewsRow`, `StatTile`, `StatCard`, `QuickAction`, `ModeBreakdown` → `pages/dashboard/components/`
  - [x] Extracted: `constants.ts`, `utils.ts` (dashboard-specific helpers/constants)
  - [ ] Thin **`Dashboard.tsx`** further so the shell is <~400 lines (move remaining inline layout/helpers if any)
  - [ ] Move `HARD_CODED_NEWS_PREVIEW` to **`pages/dashboard/mockNewsPreview.ts`** (or remove) — if still inlined, extract when trimming shell
  - [ ] **P2 overlap:** GitHub contributions + `services/github.ts` + **`useGithubActivity`**
  - [ ] **P2 overlap:** replace inline **`api.get`** (`/users/...`) with **`services/users.ts`**

### P2 — Data layer consistency

- [ ] Add `services/battles.ts` and `services/users.ts` so pages never call `axios`/`api` directly
  - [x] Added `services/battles.ts` and `services/users.ts`
  - [x] Migrated dashboard, Play presets/invites, practice solve run, battle results, and `useBattle` off direct `api`
  - [ ] Broader follow-up: author/auth/invite pages and a few shared hooks/components still import `api` directly
- [x] Centralize TanStack query keys in `lib/queryKeys.ts`:
  ```ts
  export const queryKeys = {
    userStats: (userId: string) => ['userStats', userId] as const,
    matchHistory: (userId: string, limit = 20) => ['matchHistory', userId, limit] as const,
    practice: {
      problems: () => ['practice', 'problems'] as const,
      stats: () => ['practice', 'stats'] as const,
      problem: (id: string) => ['practice', 'problem', id] as const,
    },
    newsFeed: (userId: string) => ['newsFeed', userId] as const,
    githubActivity: (userId: string, year: string) =>
      ['githubActivity', userId, year] as const,
  };
  ```
- [x] Migrate `pages/dashboard/Dashboard.tsx`, `pages/practice/*`, and `hooks/useBattle.ts` to use `queryKeys`
- [x] Audit `store/slices/battleSlice.ts`: server-shaped fields (`battle`, `problem`) now live in TanStack Query; Redux keeps battle UI flags (`isSubmitting`, `isRunning`, `usedSkills`, `activeEffects`)

### P3 — Hooks & components

- [x] Split `hooks/useBattle.ts` (thin facade) into:
  - [x] `useBattleData` (TanStack Query for battle + problem)
  - [x] `useBattleSocket` (socket subscriptions only)
  - [x] `useBattleActions` (submit/run/skills/ready)
- [x] Extract reusable layout pieces:
  - [x] `PageHero` (gradient hero used across Dashboard/Practice)
  - [x] `DataState` (loading + empty + error wrapper)
  - [x] `StatTileGrid`
- [x] Co-locate page-only components under `pages/<feature>/components/` (Dashboard + Practice; Author/Play already page-local)

### P4 — Routing & types

- [ ] Modularize `router.tsx`: split per feature into `routes/{auth,battle,practice,author,...}.tsx` and compose
- [ ] Split `types/api.ts` (~337 lines) per domain (`battle.ts`, `user.ts`, `news.ts`, `clan.ts`)
- [ ] Reconcile duplicated socket payload types between `types/socket.ts` and `types/api.ts`

### P5 — Docs / DX

- [ ] Add a short `client/ARCHITECTURE.md` (Redux vs TanStack split, socket flow, paywall flow) once P1/P2 settle
- [ ] After P0, audit for any silently kept `eslint-disable` comments

---

## 💡 Notes

- MVP first: Phase 1 is the bare minimum to test core gameplay loop
- Subscription module is Phase 2 but backend work should start in parallel with Phase 1 frontend
- Skills and Battle Royale need backend work before frontend can integrate
- Use shadcn/ui for all base components — don't build from scratch
- Monaco Editor is the heaviest dependency — lazy load it for non-battle pages
- Socket.IO connection should be established once on login, not per-page
- Keep Redux slices thin — use TanStack Query for all server state that doesn't need real-time updates
- Sound files should be small (< 100KB each) — use compressed MP3/OGG
- Test with 2 browser windows open to simulate multiplayer during development

---

**Remember:** Ship MVP fast, iterate later! Get Phase 1 working before polishing. ✅
