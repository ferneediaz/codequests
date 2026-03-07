# CodeQuest Battles Server - Quick Start Guide

## ✅ What's Done

### Implemented & Tested (57 tests passing):
1. **Authentication** - JWT with Supabase ✅
2. **User Management** - Profiles, leaderboard ✅
3. **Problems** - CRUD, test cases, filtering ✅
4. **Code Execution** - Multi-language support (Piston) ✅

### Test Coverage:
- Auth Service: ✅ All passing
- Users Service: ✅ All passing  
- Problems Service: ✅ All passing
- Code Execution: ✅ All passing
- Piston Integration: ✅ 17/17 tests passing
- Judge0 Integration: ⏭️ Skipped (optional)

## ❌ What's Not Done

1. **Battle System** - Database ready, needs implementation
2. **WebSockets** - For real-time battles
3. **Matchmaking** - MMR-based player matching
4. **Clans** - Database ready, needs implementation
5. **Advanced Rankings** - Time-based leaderboards

## 🚀 Setup (5 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_JWK

# 3. Setup database
npm run prisma:generate
npm run prisma:push
npm run prisma:seed

# 4. Run server
npm run start:dev

# 5. Open Swagger docs
# http://localhost:3000/api/docs
```

## 📡 Key Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/sync` | POST | JWT | Sync Supabase user to DB |
| `/api/auth/me` | GET | JWT | Get current user |
| `/api/users` | GET | Public | Leaderboard (sorted by MMR) |
| `/api/problems` | GET | JWT | List all problems |
| `/api/problems/random` | GET | JWT | Get random problem |
| `/api/problems/:id/execute` | POST | JWT | Execute code & get results |

Full API docs: [API_REFERENCE.md](./API_REFERENCE.md)

## 🧪 Running Tests

```bash
# All tests
npm test
# Result: 57 passing, 17 skipped

# With coverage
npm run test:cov

# Integration tests only
npm run test:integration
```

## 📚 Documentation Files

| File | Lines | Purpose |
|------|-------|---------|
| [README.md](./README.md) | 564 | Full setup & development guide |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 485 | Feature status & test results |
| [TODO.md](./TODO.md) | 361 | Detailed task breakdown |
| [API_REFERENCE.md](./API_REFERENCE.md) | 749 | Complete API documentation |

## 🔧 Environment Variables Required

### Minimum Setup:
```env
DATABASE_URL="postgresql://..."
JWT_JWK='{"kty":"EC","crv":"P-256","x":"...","y":"..."}'
```

### Optional:
```env
PISTON_URL="https://emkc.org/api/v2/piston"
JUDGE0_URL="http://localhost:2358"
PORT=3000
```

## 🎯 Success Criteria

**This feature is marked as SUCCESS only when ALL test cases pass.**

### Current Status:
✅ **Phase 1 Complete** - Auth, Users, Problems, Code Execution  
⏳ **Phase 2 Pending** - Battles, WebSockets, Matchmaking

### Next Steps (Priority Order):
1. Implement Battle System (HIGH)
2. Add WebSocket support (HIGH)
3. Build Matchmaking (HIGH)
4. Add Clan features (MEDIUM)

See [TODO.md](./TODO.md) for detailed implementation plan.

## 💻 Code Execution

### Supported Languages:
- Python 3.10
- JavaScript (Node 20)
- TypeScript
- Java 17+
- C++ (GCC 11+)
- C (GCC 11+)
- Rust 1.70+

### Engines:
- **Piston** (Default) - ✅ Working, all tests passing
- **Judge0** (Optional) - ✅ Integrated, requires Docker setup

## 📊 Sample Data (After Seed)

### Users:
- **admin@codequest.dev** - Admin (MMR: 1500)
- **alice@example.com** - User (MMR: 1200)
- **bob@example.com** - User (MMR: 1000)

### Problems: 7 total
- 2 EASY (Two Sum, Reverse String)
- 3 MEDIUM (FizzBuzz, Palindrome, Valid Parentheses)
- 2 HARD (Merge Sort, Binary Search Tree)

## 🔍 Quick Troubleshooting

### Database Issues:
```bash
npm run prisma:studio  # Visual database browser
```

### Test Failures:
```bash
npm test -- --clearCache
npm test -- --verbose
```

### Code Execution Not Working:
```bash
# Test Piston API
curl https://emkc.org/api/v2/piston/runtimes
```

### Authentication Failing:
- Check JWT_JWK format in .env
- Verify Supabase token is valid
- Test in Swagger UI (has built-in auth)

## 📖 Need More Info?

- **Setup & Installation:** [README.md](./README.md)
- **What's Implemented:** [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- **What's Next:** [TODO.md](./TODO.md)
- **API Usage:** [API_REFERENCE.md](./API_REFERENCE.md)
- **Interactive Docs:** http://localhost:3000/api/docs

---

**Built with NestJS, TypeScript, Prisma, and ❤️**
