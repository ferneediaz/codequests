# CodeQuest API Testing Guide

## Getting Started

### 1. Start the Server

```bash
cd server
npm run start:dev
```

### 2. Access Swagger Docs

Open your browser and navigate to:
```
http://localhost:3000/api/docs
```

### 3. Authentication Setup

Most endpoints require JWT authentication from Supabase.

**To get a JWT token:**
1. Sign in through your Supabase Auth (frontend or Supabase dashboard)
2. Copy the `access_token` from the session
3. In Swagger, click the **"Authorize"** button (🔓) at the top
4. Enter: `your-jwt-token-here` (without "Bearer" prefix - Swagger adds it)
5. Click **"Authorize"**

---

## API Endpoints Test Checklist

### 🔐 AUTH (`/api/auth`)

#### POST `/api/auth/sync`
**Purpose:** Sync Supabase user to local database (call after signup/login)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Body | `{ "username": "optional-username" }` |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Body (optional):
   ```json
   { "username": "myusername" }
   ```
4. Click "Execute"

**Expected:** `201` - User object returned

---

#### GET `/api/auth/me`
**Purpose:** Get current authenticated user's profile

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Body | None |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Click "Execute"

**Expected:** `200` - Your user profile with clan info

---

### 👤 USERS (`/api/users`)

#### GET `/api/users`
**Purpose:** Get all users (leaderboard)

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Query Params | `limit` (default: 50), `offset` (default: 0) |

**Test Steps:**
1. Click "Try it out"
2. Set `limit=10`, `offset=0`
3. Click "Execute"

**Expected:** `200` - Array of users sorted by MMR (descending)

---

#### GET `/api/users/{id}`
**Purpose:** Get user by ID

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `id` - User ID |

**Test Steps:**
1. Click "Try it out"
2. Enter a valid user ID
3. Click "Execute"

**Expected:** `200` - User object with clan and recent battles

---

#### GET `/api/users/username/{username}`
**Purpose:** Get user by username

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `username` |

**Test Steps:**
1. Click "Try it out"
2. Enter a valid username
3. Click "Execute"

**Expected:** `200` - User object

---

#### PATCH `/api/users/{id}`
**Purpose:** Update user profile (own profile only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Your user ID |
| Body | `{ "username": "new-name", "avatarUrl": "url" }` |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Enter YOUR user ID
4. Body:
   ```json
   { "username": "newname123" }
   ```
5. Click "Execute"

**Expected:** `200` - Updated user object
**Error:** `403` if trying to update another user's profile

---

#### GET `/api/users/{id}/history`
**Purpose:** Get user's match history

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `id` - User ID |
| Query Param | `limit` (default: 20) |

**Test Steps:**
1. Click "Try it out"
2. Enter a user ID
3. Set `limit=10`
4. Click "Execute"

**Expected:** `200` - Array of battle participations

---

#### GET `/api/users/{id}/stats`
**Purpose:** Get user stats (MMR, win rate, tier)

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `id` - User ID |

**Test Steps:**
1. Click "Try it out"
2. Enter a user ID
3. Click "Execute"

**Expected:** `200` - Stats object:
```json
{
  "mmr": 1500,
  "wins": 15,
  "losses": 5,
  "totalGames": 20,
  "winRate": 75,
  "tier": "Platinum"
}
```

---

### ⚔️ PROBLEMS (`/api/problems`)

> **Note:** All problem endpoints require authentication

#### GET `/api/problems`
**Purpose:** Get all problems (paginated)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Query Params | `difficulty` (EASY/MEDIUM/HARD), `page`, `limit` |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Set `difficulty=EASY`, `page=1`, `limit=10`
4. Click "Execute"

**Expected:** `200` - Paginated problems with visible test cases only

---

#### GET `/api/problems/random`
**Purpose:** Get a random problem

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Query Param | `difficulty` (optional) |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Optionally set `difficulty=MEDIUM`
4. Click "Execute"

**Expected:** `200` - Random problem object

---

#### GET `/api/problems/{id}`
**Purpose:** Get problem by ID

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Problem ID |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Enter a problem ID
4. Click "Execute"

**Expected:** `200` - Problem with visible test cases (admins see all)

---

#### POST `/api/problems`
**Purpose:** Create a new problem (Admin only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required (Admin) |
| Body | See below |

**Test Body:**
```json
{
  "title": "Two Sum",
  "description": "Given an array of integers...",
  "difficulty": "EASY",
  "starterCode": {
    "javascript": "function twoSum(nums, target) {\n  // your code\n}",
    "python": "def two_sum(nums, target):\n    pass"
  },
  "testCases": [
    {
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isHidden": false
    },
    {
      "input": "[3,2,4]\n6",
      "expectedOutput": "[1,2]",
      "isHidden": true
    }
  ]
}
```

**Expected:** `201` - Created problem
**Error:** `403` if not admin

---

#### POST `/api/problems/{id}/execute`
**Purpose:** Execute code against test cases

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Problem ID |
| Body | `{ "code": "...", "language": "javascript" }` |

**Test Body:**
```json
{
  "code": "function twoSum(nums, target) {\n  return [0, 1];\n}",
  "language": "javascript"
}
```

**Expected:** `200` - Execution results:
```json
{
  "passed": 1,
  "total": 2,
  "allPassed": false,
  "results": [...]
}
```

---

#### PATCH `/api/problems/{id}`
**Purpose:** Update a problem (Admin only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required (Admin) |
| Path Param | `id` - Problem ID |
| Body | Partial problem object |

---

#### DELETE `/api/problems/{id}`
**Purpose:** Delete a problem (Admin only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required (Admin) |
| Path Param | `id` - Problem ID |

---

#### GET `/api/problems/{id}/testcases`
**Purpose:** Get all test cases including hidden (Admin only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required (Admin) |
| Path Param | `id` - Problem ID |

---

### ⚔️ BATTLES (`/api/battles`)

> **Note:** All battle endpoints require authentication

#### POST `/api/battles`
**Purpose:** Create a new battle

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Body | See below |

**Test Body (1v1):**
```json
{
  "problemId": "problem-id-here",
  "mode": "ONE_V_ONE",
  "timeLimitMinutes": 15
}
```

**Test Body (Clan vs Clan):**
```json
{
  "mode": "CLAN_VS_CLAN",
  "teamSize": 3,
  "timeLimitMinutes": 30
}
```

**Expected:** `201` - Battle object with you as first participant

---

#### GET `/api/battles/available`
**Purpose:** Get battles you can join

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Click "Execute"

**Expected:** `200` - Array of WAITING battles you're not already in

---

#### GET `/api/battles/history`
**Purpose:** Get your battle history

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Query Params | `page`, `limit` |

**Test Steps:**
1. Authorize with your JWT
2. Click "Try it out"
3. Set `page=1`, `limit=10`
4. Click "Execute"

**Expected:** `200` - Paginated battle history

---

#### GET `/api/battles/{id}`
**Purpose:** Get battle details

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Battle ID |

**Expected:** `200` - Full battle object with participants, problem, etc.

---

#### POST `/api/battles/{id}/join`
**Purpose:** Join an existing battle

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Battle ID |

**Expected:** `200` - Updated battle (may auto-start if full)
**Errors:**
- `400` - Battle full or not in WAITING status
- `404` - Battle not found

---

#### POST `/api/battles/{id}/submit`
**Purpose:** Submit your solution

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Battle ID |
| Body | See below |

**Test Body:**
```json
{
  "code": "function solution() { return 42; }",
  "language": "javascript"
}
```

**Expected:** `200` - Submission results with test case outcomes
**Errors:**
- `400` - Battle not IN_PROGRESS
- `403` - Not a participant

---

#### POST `/api/battles/{id}/complete`
**Purpose:** Force complete a battle (for timeouts)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Battle ID |

**Expected:** `200` - Completed battle with winner determined

---

### 🏰 CLANS (`/api/clans`)

#### GET `/api/clans`
**Purpose:** Get all clans (sorted by MMR)

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Query Params | `limit`, `offset` |

**Expected:** `200` - Array of clans

---

#### GET `/api/clans/{id}`
**Purpose:** Get clan by ID

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `id` - Clan ID |

**Expected:** `200` - Clan with members

---

#### GET `/api/clans/tag/{tag}`
**Purpose:** Get clan by tag

| Requirement | Details |
|-------------|---------|
| Auth | ❌ Not required |
| Path Param | `tag` - Clan tag (e.g., "CW") |

**Expected:** `200` - Clan object

---

#### POST `/api/clans`
**Purpose:** Create a new clan

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Body | `{ "name": "Code Warriors", "tag": "CW" }` |

**Test Body:**
```json
{
  "name": "My Awesome Clan",
  "tag": "MAC"
}
```

**Expected:** `201` - Created clan (you become owner and member)
**Errors:**
- `400` - Already in a clan
- `400` - Name or tag already taken

---

#### PATCH `/api/clans/{id}`
**Purpose:** Update clan (owner only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Clan ID |
| Body | `{ "name": "New Name" }` |

**Expected:** `200` - Updated clan
**Error:** `403` - Not the owner

---

#### POST `/api/clans/{id}/join`
**Purpose:** Join a clan

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Clan ID to join |

**Expected:** `200` - Clan object
**Error:** `400` - Already in a clan

---

#### POST `/api/clans/leave`
**Purpose:** Leave current clan

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |

**Expected:** `200` - Success message
**Error:** `400` - Not in a clan

---

#### DELETE `/api/clans/{id}/members/{memberId}`
**Purpose:** Kick a member (owner only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Params | `id` - Clan ID, `memberId` - User ID to kick |

**Expected:** `200` - Updated clan
**Error:** `403` - Not the owner

---

#### DELETE `/api/clans/{id}`
**Purpose:** Delete clan (owner only)

| Requirement | Details |
|-------------|---------|
| Auth | ✅ Required |
| Path Param | `id` - Clan ID |

**Expected:** `200` - Success message
**Error:** `403` - Not the owner

---

## Quick Test Flow

Here's a suggested order to test the full flow:

### 1. Basic Setup
- [ ] `POST /api/auth/sync` - Create your user
- [ ] `GET /api/auth/me` - Verify your profile

### 2. User Operations
- [ ] `GET /api/users` - Check leaderboard
- [ ] `GET /api/users/{id}/stats` - Get your stats
- [ ] `PATCH /api/users/{id}` - Update your username

### 3. Clan Operations
- [ ] `GET /api/clans` - List clans
- [ ] `POST /api/clans` - Create a clan
- [ ] `GET /api/clans/tag/{tag}` - Find your clan
- [ ] `POST /api/clans/{id}/join` (with another user)

### 4. Problems (Need seed data or create as admin)
- [ ] `GET /api/problems` - List problems
- [ ] `GET /api/problems/random` - Get random problem
- [ ] `POST /api/problems/{id}/execute` - Test code execution

### 5. Battle Flow
- [ ] `POST /api/battles` - Create a battle
- [ ] `GET /api/battles/available` - (with another user) See available
- [ ] `POST /api/battles/{id}/join` - (with another user) Join
- [ ] `POST /api/battles/{id}/submit` - Submit solutions
- [ ] `GET /api/battles/history` - Check history

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Missing/invalid JWT | Re-authorize in Swagger |
| `403 Forbidden` | Not admin or not owner | Check permissions |
| `404 Not Found` | Invalid ID | Verify the ID exists |
| `400 Bad Request` | Invalid body/params | Check request format |

---

## Sample Test Data

### User IDs (from your database)
```
Get these by calling GET /api/users
```

### Problem IDs (from your database)
```
Get these by calling GET /api/problems
```

### Battle Modes
- `ONE_V_ONE` - 1v1 battle
- `CLAN_VS_CLAN` - Team battle
- `GROUP` - Multiple problems

### Difficulty Levels
- `EASY`
- `MEDIUM`
- `HARD`

### Languages
- `javascript`
- `python`
- `typescript`
- `java`
- `cpp`
- `c`
- `rust`
