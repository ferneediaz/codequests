# Subscriptions & Paywall Implementation

CodeQuest Battles uses a **freemium model** — users get limited free games per day, then must subscribe for unlimited access. Free users do not have stats persisted. New users can start a **7-day free trial** with full Pro benefits.

---

## Business Model

### Free Tier
| Feature | Access |
|---------|--------|
| Games per day | **1** |
| All game modes | ✅ |
| Clans | ✅ |
| Stats persistence | ❌ |

### Free Trial (7 days, one-time)
| Feature | Access |
|---------|--------|
| Games per day | **Unlimited** |
| All game modes | ✅ |
| Clans | ✅ |
| Stats persistence | ✅ |

### Pro Subscription ($5/2 months or $24.99/year)
| Feature | Access |
|---------|--------|
| Games per day | **Unlimited** |
| All game modes | ✅ |
| Clans | ✅ |
| Stats persistence | ✅ |

---

## Database Schema (Prisma)

```prisma
model User {
  id        String  @id @default(uuid())
  email     String  @unique
  username  String  @unique
  avatarUrl String?
  role      String  @default("user")

  // Stats
  mmr    Int @default(1000)
  wins   Int @default(0)
  losses Int @default(0)

  // Subscription
  subscriptionTier SubscriptionTier @default(FREE)
  stripeCustomerId String?          @unique
  gamesPlayedToday Int              @default(0)
  lastGameResetAt  DateTime         @default(now())
  trialEndsAt      DateTime?
  hasUsedTrial     Boolean          @default(false)
  subscription     Subscription?

  // ...other relations
}

model Subscription {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id])

  stripeSubscriptionId String             @unique
  stripePriceId        String
  status               SubscriptionStatus
  currentPeriodStart   DateTime
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean            @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum SubscriptionTier {
  FREE
  PRO
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
  UNPAID
}
```

---

## Module Structure

```
src/subscriptions/
├── subscriptions.module.ts          # Module registration
├── subscriptions.controller.ts      # REST endpoints
├── subscriptions.service.ts         # Core business logic + webhook handlers + cron
├── stripe.service.ts                # Stripe SDK wrapper
├── subscriptions.service.spec.ts    # Unit tests (39 tests)
└── dto/
    ├── create-checkout.dto.ts
    └── subscription-status-response.dto.ts
```

---

## API Endpoints

### REST Endpoints

```typescript
@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  // Get current user's subscription status
  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  async getStatus(@Req() req: AuthRequest): Promise<SubscriptionStatusResponseDto>

  // Create Stripe checkout session
  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  async createCheckout(
    @Req() req: AuthRequest,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ sessionUrl: string }>

  // Create Stripe customer portal session (manage subscription)
  @Post('portal')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  async createPortal(@Req() req: AuthRequest): Promise<{ portalUrl: string }>

  // Start a 7-day free trial (one-time per user)
  @Post('trial')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  async startTrial(@Req() req: AuthRequest): Promise<{ trialEndsAt: Date }>

  // Stripe webhook handler (no auth — uses stripe-signature verification)
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<void>
}
```

### DTOs

```typescript
// POST /subscriptions/checkout
class CreateCheckoutDto {
  @IsIn(['bimonthly', 'yearly'])
  plan: 'bimonthly' | 'yearly';
}

// GET /subscriptions/status
class SubscriptionStatusResponseDto {
  tier: 'free' | 'pro' | 'trial';
  gamesRemaining: number;      // For free tier (1 max), Infinity for pro/trial
  gamesPlayedToday: number;
  dailyLimit: number;           // 1 for free, Infinity for pro/trial
  resetsAt: string;             // ISO timestamp (next midnight UTC)
  trialEndsAt?: string;         // ISO timestamp (only present during active trial)
  subscription?: SubscriptionDetailsDto;
}

class SubscriptionDetailsDto {
  status: string;               // ACTIVE, CANCELED, PAST_DUE, UNPAID
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}
```

---

## Core Service

### SubscriptionsService

All subscription logic lives in a single service (no separate `GameLimitService`). Key methods:

```typescript
export const FREE_DAILY_LIMIT = 1;
export const TRIAL_DURATION_DAYS = 7;

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  // Check if a trial is currently active
  isTrialActive(trialEndsAt: Date | null): boolean

  // Start a 7-day free trial (one-time per user)
  async startTrial(userId: string): Promise<{ trialEndsAt: Date }>

  // Check if a user can start/join a game (Pro/trial = unlimited, free = limited)
  async canPlay(userId: string): Promise<boolean>

  // Increment the daily games played counter
  async incrementGamesPlayed(userId: string): Promise<void>

  // Lazy daily reset — compares UTC dates
  async checkAndResetDailyGames(userId: string, lastGameResetAt: Date): Promise<void>

  // Get subscription status for the status endpoint
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponseDto>

  // Create checkout session (resolves price ID from plan type)
  async createCheckoutSession(userId: string, plan: 'bimonthly' | 'yearly'): Promise<string>

  // Create portal session for managing subscription
  async createPortalSession(userId: string): Promise<string>

  // Process Stripe webhook events
  async handleWebhookEvent(event: StripeWebhookEvent): Promise<void>

  // Cron: resets all free users' daily game counts at midnight UTC
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async resetAllDailyGameCounts(): Promise<void>
}
```

#### `canPlay` logic

1. Pro users or active trial → always `true`
2. Free users (no active trial) → lazy daily reset via `checkAndResetDailyGames`, then check `gamesPlayedToday < FREE_DAILY_LIMIT`

#### `startTrial` logic

1. Validates user exists, hasn't already used trial, and isn't already Pro
2. Sets `trialEndsAt` to 7 days from now and `hasUsedTrial = true`
3. Returns the `trialEndsAt` date

#### `checkAndResetDailyGames` logic

Compares `lastGameResetAt` date (UTC) with today's date (UTC). If different, resets `gamesPlayedToday` to 0 and updates `lastGameResetAt`.

#### `createCheckoutSession` logic

1. Find user, get or create Stripe customer
2. Resolve price ID: `STRIPE_PRICE_ID_YEARLY` for yearly, `STRIPE_PRICE_ID_BIMONTHLY` for bimonthly
3. Delegate to `StripeService.createCheckoutSession`

---

## Stripe Integration

### StripeService

Uses Stripe SDK v22 with `import Stripe = require('stripe')` (v22 export structure requires this pattern).

```typescript
@Injectable()
export class StripeService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!);
  }

  async createCustomer(email: string, userId: string): Promise<string>
  async createCheckoutSession(customerId: string, priceId: string, userId: string): Promise<string>
  async createPortalSession(customerId: string): Promise<string>
  constructWebhookEvent(body: Buffer, signature: string): any
}
```

Checkout sessions include `{CHECKOUT_SESSION_ID}` in the success URL for client-side verification.

### Webhook Events

Handled in `SubscriptionsService.handleWebhookEvent`:

| Event | Handler | Effect |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutCompleted` | Saves `stripeCustomerId` on User |
| `customer.subscription.created` | `handleSubscriptionUpdated` | Sets tier to PRO, upserts Subscription record |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Updates tier + Subscription record |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Sets tier to FREE, marks Subscription CANCELED |
| `invoice.payment_failed` | `handlePaymentFailed` | Marks Subscription PAST_DUE |

#### Status Mapping

```typescript
private mapStripeStatus(status: string): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' {
  switch (status) {
    case 'active':
    case 'trialing':  return 'ACTIVE';
    case 'canceled':  return 'CANCELED';
    case 'past_due':  return 'PAST_DUE';
    case 'unpaid':    return 'UNPAID';
    default:          return 'ACTIVE';
  }
}
```

---

## Battle Integration

Subscription gating is enforced directly in `BattlesService` (no guards or decorators needed):

### Game Limit Checks

```typescript
// In BattlesService.createBattle() and joinBattle():
const canPlay = await this.subscriptionsService.canPlay(userId);
if (!canPlay) {
  throw new ForbiddenException(
    'Daily free game limit reached. Upgrade to Pro for unlimited games.',
  );
}
```

### Game Count Increment

When a battle starts (enough players join), all participants get their game count incremented:

```typescript
// In BattlesService.joinBattle(), when shouldStart is true:
for (const p of battle.participants) {
  await this.subscriptionsService.incrementGamesPlayed(p.userId);
}
await this.subscriptionsService.incrementGamesPlayed(userId);
```

### Free User Stats Gating

In `BattlesService.completeBattle()`, stats (wins/losses/mmr) are only persisted for Pro and trial users:

```typescript
const hasProAccess =
    participant.user.subscriptionTier === 'PRO' ||
    (participant.user.trialEndsAt && new Date(participant.user.trialEndsAt) > new Date());
if (!isTeam && hasProAccess) {
  // Update mmr, wins, losses
}
```

---

## Cron Jobs

Daily game count reset runs via `@nestjs/schedule` (uses `ScheduleModule.forRoot()` already imported in matchmaking module):

```typescript
@Cron('0 0 * * *', { timeZone: 'UTC' })
async resetAllDailyGameCounts(): Promise<void> {
  const result = await this.prisma.user.updateMany({
    where: { subscriptionTier: 'FREE' },
    data: {
      gamesPlayedToday: 0,
      lastGameResetAt: new Date(),
    },
  });
  this.logger.log(`Daily game counts reset for ${result.count} free users`);
}
```

There is also a **lazy per-user reset** in `checkAndResetDailyGames` that fires on `canPlay` and `getSubscriptionStatus` calls, so users are never blocked due to cron timing.

---

## App Configuration

### Raw body for webhooks

`main.ts` enables raw body parsing required by Stripe webhook signature verification:

```typescript
const app = await NestFactory.create(AppModule, { rawBody: true });
```

### Module registration

`SubscriptionsModule` is imported in `AppModule`. `BattlesModule` imports `SubscriptionsModule` for the `canPlay`/`incrementGamesPlayed` integration.

---

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_BIMONTHLY=price_xxx
STRIPE_PRICE_ID_YEARLY=price_xxx

# Client URL (for Stripe redirects)
CLIENT_URL=http://localhost:5173
```

---

## Testing

39 unit tests in `subscriptions.service.spec.ts`:

| Group | Count | Coverage |
|-------|-------|----------|
| canPlay | 7 | Pro unlimited, free under limit, free at limit, user not found, lazy reset, active trial unlimited, expired trial blocked |
| isTrialActive | 3 | Future date (true), past date (false), null (false) |
| startTrial | 4 | Activates 7-day trial, already used trial, already Pro, user not found |
| incrementGamesPlayed | 1 | Increments counter |
| checkAndResetDailyGames | 2 | Same day (no reset), different day (resets) |
| getSubscriptionStatus | 4 | Free user, Pro user, user not found, trial user with unlimited |
| createCheckoutSession | 5 | New customer, existing customer, yearly plan, user not found, missing price config |
| createPortalSession | 3 | Success, user not found, no customer ID |
| handleWebhookEvent | 7 | Checkout completed, subscription created/updated, subscription deleted, payment failed, missing metadata, unhandled event |
| resetAllDailyGameCounts | 1 | Resets all free users |
| Constants | 2 | `FREE_DAILY_LIMIT === 1`, `TRIAL_DURATION_DAYS === 7` |

Battle integration tests (6 tests in `battles.service.spec.ts`):
- Blocks `createBattle` when daily limit reached
- Blocks `joinBattle` when daily limit reached
- Allows battle creation when `canPlay` returns true
- Increments game count for all participants when battle starts
- Only persists stats for Pro users in `completeBattle`
- Persists stats for trial users in `completeBattle`
