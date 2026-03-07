# CodeQuest Battles - API Reference

**Base URL:** `http://localhost:3000/api`  
**Interactive Docs:** http://localhost:3000/api/docs

---

## 🔐 Authentication

All protected endpoints require a JWT token from Supabase Auth.

### Getting a Token

1. Sign up/Login via Supabase Auth (client-side)
2. Get the JWT access token
3. Include it in requests:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Swagger UI Authentication

1. Go to http://localhost:3000/api/docs
2. Click the **Authorize** button (🔓)
3. Paste your JWT token
4. Click **Authorize**

---

## 📡 Endpoints

### Authentication & User Sync

#### POST `/api/auth/sync`
Sync Supabase user to local database. Call this after sign up or login.

**Auth Required:** ✅ JWT  
**Role:** Any authenticated user

**Request Body:**
```json
{
  "username": "johndoe"
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "email": "john@example.com",
  "username": "johndoe",
  "role": "user",
  "avatarUrl": null,
  "mmr": 1000,
  "wins": 0,
  "losses": 0,
  "clanId": null,
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/auth/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "johndoe"}'
```

---

#### GET `/api/auth/me`
Get current authenticated user's profile.

**Auth Required:** ✅ JWT  
**Role:** Any authenticated user

**Response:**
```json
{
  "id": "uuid-here",
  "email": "john@example.com",
  "username": "johndoe",
  "role": "user",
  "avatarUrl": null,
  "mmr": 1000,
  "wins": 0,
  "losses": 0,
  "clanId": null,
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

**Example:**
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Users & Leaderboard

#### GET `/api/users`
Get all users sorted by MMR (leaderboard).

**Auth Required:** ❌ Public  
**Query Parameters:**
- `limit` (optional, default: 50) - Number of users to return
- `offset` (optional, default: 0) - Pagination offset

**Response:**
```json
[
  {
    "id": "uuid-1",
    "username": "alice",
    "avatarUrl": "https://...",
    "mmr": 1500,
    "wins": 10,
    "losses": 5,
    "role": "user"
  },
  {
    "id": "uuid-2",
    "username": "bob",
    "avatarUrl": null,
    "mmr": 1200,
    "wins": 5,
    "losses": 5,
    "role": "user"
  }
]
```

**Example:**
```bash
# Get top 10 users
curl http://localhost:3000/api/users?limit=10

# Get next 10 users (pagination)
curl http://localhost:3000/api/users?limit=10&offset=10
```

---

#### GET `/api/users/:id`
Get user by ID.

**Auth Required:** ❌ Public

**Response:**
```json
{
  "id": "uuid-here",
  "email": "alice@example.com",
  "username": "alice",
  "role": "user",
  "avatarUrl": "https://...",
  "mmr": 1500,
  "wins": 10,
  "losses": 5,
  "clanId": null,
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/users/uuid-here
```

---

#### PATCH `/api/users/:id`
Update user profile (own profile only, unless admin).

**Auth Required:** ✅ JWT  
**Role:** Owner or Admin

**Request Body:**
```json
{
  "username": "newestusername",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/users/YOUR_USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "newname"}'
```

---

### Problems

#### POST `/api/problems`
Create a new coding problem (admin only).

**Auth Required:** ✅ JWT  
**Role:** Admin only

**Request Body:**
```json
{
  "title": "Two Sum",
  "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
  "difficulty": "EASY",
  "starterCode": {
    "javascript": "function twoSum(nums, target) {\n  // Your code here\n}",
    "python": "def two_sum(nums, target):\n    # Your code here\n    pass"
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

**Response:**
```json
{
  "id": "problem-uuid",
  "title": "Two Sum",
  "description": "Given an array...",
  "difficulty": "EASY",
  "starterCode": {
    "javascript": "function twoSum(nums, target) {...}",
    "python": "def two_sum(nums, target):..."
  },
  "testCases": [
    {
      "id": "test-uuid-1",
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isHidden": false
    }
  ],
  "createdAt": "2026-03-07T10:00:00.000Z",
  "updatedAt": "2026-03-07T10:00:00.000Z"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/problems \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @problem.json
```

---

#### GET `/api/problems`
List all problems with pagination and filtering.

**Auth Required:** ✅ JWT  
**Query Parameters:**
- `difficulty` (optional) - Filter by: `EASY`, `MEDIUM`, `HARD`
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Response:**
```json
{
  "data": [
    {
      "id": "problem-1",
      "title": "Two Sum",
      "description": "Given an array...",
      "difficulty": "EASY",
      "starterCode": {...},
      "testCases": [...], // Only non-hidden test cases (unless admin)
      "createdAt": "2026-03-07T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 7,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Examples:**
```bash
# Get all problems (first page)
curl http://localhost:3000/api/problems \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by difficulty
curl "http://localhost:3000/api/problems?difficulty=EASY" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Pagination
curl "http://localhost:3000/api/problems?page=2&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### GET `/api/problems/random`
Get a random problem, optionally filtered by difficulty.

**Auth Required:** ✅ JWT  
**Query Parameters:**
- `difficulty` (optional) - Filter by: `EASY`, `MEDIUM`, `HARD`

**Response:**
```json
{
  "id": "problem-1",
  "title": "Two Sum",
  "description": "Given an array...",
  "difficulty": "EASY",
  "starterCode": {
    "javascript": "function twoSum(nums, target) {...}",
    "python": "def two_sum(nums, target):..."
  },
  "testCases": [
    {
      "id": "test-1",
      "input": "[2,7,11,15]\n9",
      "expectedOutput": "[0,1]",
      "isHidden": false
    }
  ]
}
```

**Examples:**
```bash
# Random problem (any difficulty)
curl http://localhost:3000/api/problems/random \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Random EASY problem
curl "http://localhost:3000/api/problems/random?difficulty=EASY" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### GET `/api/problems/:id`
Get problem details by ID.

**Auth Required:** ✅ JWT  
**Note:** Hidden test cases only visible to admins

**Response:**
```json
{
  "id": "problem-1",
  "title": "Two Sum",
  "description": "Given an array...",
  "difficulty": "EASY",
  "starterCode": {...},
  "testCases": [...], // Hidden tests excluded for non-admins
  "createdAt": "2026-03-07T10:00:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/problems/problem-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### GET `/api/problems/:id/testcases`
Get ALL test cases for a problem (including hidden ones). Admin only.

**Auth Required:** ✅ JWT  
**Role:** Admin only

**Response:**
```json
[
  {
    "id": "test-1",
    "input": "[2,7,11,15]\n9",
    "expectedOutput": "[0,1]",
    "isHidden": false
  },
  {
    "id": "test-2",
    "input": "[3,2,4]\n6",
    "expectedOutput": "[1,2]",
    "isHidden": true
  }
]
```

**Example:**
```bash
curl http://localhost:3000/api/problems/problem-uuid/testcases \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

#### PATCH `/api/problems/:id`
Update a problem (admin only).

**Auth Required:** ✅ JWT  
**Role:** Admin only

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "difficulty": "MEDIUM"
}
```

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/problems/problem-uuid \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "MEDIUM"}'
```

---

#### DELETE `/api/problems/:id`
Delete a problem (admin only).

**Auth Required:** ✅ JWT  
**Role:** Admin only

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/problems/problem-uuid \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

### Code Execution

#### POST `/api/problems/:id/execute`
Execute code against problem test cases.

**Auth Required:** ✅ JWT  
**Role:** Any authenticated user

**Request Body:**
```json
{
  "code": "function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}",
  "language": "javascript"
}
```

**Supported Languages:**
- `javascript`
- `python`
- `typescript`
- `java`
- `cpp`
- `c`
- `rust`

**Response:**
```json
{
  "passed": 2,
  "total": 3,
  "allPassed": false,
  "results": [
    {
      "testCase": {
        "input": "[2,7,11,15]\n9",
        "expectedOutput": "[0,1]",
        "isHidden": false
      },
      "actualOutput": "[0,1]",
      "passed": true,
      "executionTime": "0.045s",
      "error": null,
      "status": {
        "id": 3,
        "description": "Accepted"
      }
    },
    {
      "testCase": {
        "input": "[3,2,4]\n6",
        "expectedOutput": "[1,2]",
        "isHidden": false
      },
      "actualOutput": "[1,2]",
      "passed": true,
      "executionTime": "0.042s",
      "error": null,
      "status": {
        "id": 3,
        "description": "Accepted"
      }
    },
    {
      "testCase": {
        "input": "[3,3]\n6",
        "expectedOutput": "[0,1]",
        "isHidden": true
      },
      "actualOutput": "",
      "passed": false,
      "executionTime": "0.050s",
      "error": null,
      "status": {
        "id": 4,
        "description": "Wrong Answer"
      }
    }
  ]
}
```

**Status Codes:**
- `3` - Accepted (correct output)
- `4` - Wrong Answer
- `5` - Time Limit Exceeded
- `6` - Compilation Error
- `11` - Runtime Error (NZEC)
- `12` - Runtime Error (SIGSEGV)
- `13` - Runtime Error (Other)

**Example:**
```bash
curl -X POST http://localhost:3000/api/problems/problem-uuid/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def two_sum(nums, target):\n    map = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in map:\n            return [map[complement], i]\n        map[num] = i\n    return []",
    "language": "python"
  }'
```

---

## 🚧 Not Yet Implemented

The following endpoints are planned but not yet implemented:

### Battles (TODO)

```
POST   /api/battles              # Create a battle
POST   /api/battles/:id/join     # Join a battle
POST   /api/battles/:id/submit   # Submit solution
GET    /api/battles/:id          # Get battle details
GET    /api/battles/history      # Get user's battle history
```

### Matchmaking (TODO)

```
POST   /api/matchmaking/queue    # Join matchmaking queue
DELETE /api/matchmaking/queue    # Leave queue
GET    /api/matchmaking/status   # Check queue status
```

### Clans (TODO)

```
POST   /api/clans                # Create a clan
GET    /api/clans/:id            # Get clan details
GET    /api/clans/:id/members    # List clan members
POST   /api/clans/:id/join       # Join a clan
POST   /api/clans/:id/invite     # Invite a player
DELETE /api/clans/:id/leave      # Leave a clan
DELETE /api/clans/:id            # Disband clan
```

### Rankings (TODO)

```
GET    /api/rankings/global      # Global leaderboard
GET    /api/rankings/clans       # Clan leaderboard
```

---

## 🔥 WebSocket Events (TODO)

Real-time features will use Socket.IO:

### Battle Events
```javascript
// Client → Server
socket.emit('battle:join', { battleId })
socket.emit('battle:submit', { battleId, code, language })

// Server → Client
socket.on('battle:created', { battle })
socket.on('battle:player_joined', { userId, username })
socket.on('battle:started', { battle })
socket.on('battle:submission', { userId, testsPassed, totalTests })
socket.on('battle:completed', { winnerId, results })
```

### Matchmaking Events
```javascript
// Client → Server
socket.emit('matchmaking:join', { difficulty, mode })
socket.emit('matchmaking:leave')

// Server → Client
socket.on('matchmaking:searching', { queuePosition })
socket.on('matchmaking:match_found', { battleId, opponent })
socket.on('matchmaking:cancelled')
```

---

## 📝 Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

### Common Status Codes:
- `200` - OK
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid JWT)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Validation Errors Example:
```json
{
  "statusCode": 400,
  "message": [
    "username must be shorter than or equal to 20 characters",
    "username should not be empty"
  ],
  "error": "Bad Request"
}
```

---

## 🧪 Testing the API

### Using cURL

```bash
# Get JWT token from Supabase (client-side)
JWT_TOKEN="your-jwt-token-here"

# Test auth endpoint
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get random problem
curl -X GET http://localhost:3000/api/problems/random \
  -H "Authorization: Bearer $JWT_TOKEN"

# Execute code
curl -X POST http://localhost:3000/api/problems/PROBLEM_ID/execute \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "print(\"Hello World\")",
    "language": "python"
  }'
```

### Using JavaScript/Fetch

```javascript
const JWT_TOKEN = 'your-jwt-token';

// Get current user
const user = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`
  }
}).then(r => r.json());

// Get problems
const problems = await fetch('http://localhost:3000/api/problems', {
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`
  }
}).then(r => r.json());

// Execute code
const result = await fetch(`http://localhost:3000/api/problems/${problemId}/execute`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'def solution():\n    return 42',
    language: 'python'
  })
}).then(r => r.json());
```

### Using Swagger UI

The easiest way to test is via Swagger UI:
1. Go to http://localhost:3000/api/docs
2. Click **Authorize** and paste your JWT token
3. Try any endpoint with the interactive UI!

---

## 📚 Related Documentation

- **[README.md](./README.md)** - Setup & installation guide
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - Feature status & test results
- **[TODO.md](./TODO.md)** - Detailed task breakdown

---

**For questions or issues, check the Swagger docs at http://localhost:3000/api/docs**
