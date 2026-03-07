# Subscriptions & Paywall Implementation

CodeQuest Battles uses a **freemium model** similar to GeoGuessr — users get limited free games per day, then must subscribe for unlimited access.

---

## Business Model

### Free Tier
| Feature | Access |
|---------|--------|
| Games per day | **2** |
| Casual matchmaking | ✅ |
| Ranked matchmaking | ❌ |
| Battle Royale | ❌ |
| Clans & Clan Wars | ❌ |
| Basic profile | ✅ |
| Match history | Last 5 games |

### Pro Subscription ($7.99/month or $59.99/year)
| Feature | Access |
|---------|--------|
| Games per day | **Unlimited** |
| Casual matchmaking | ✅ |
| Ranked matchmaking | ✅ |
| Battle Royale | ✅ |
| Clans & Clan Wars | ✅ |
| Full profile & stats | ✅ |
| Match history | Unlimited |
| Priority matchmaking | ✅ |
| Exclusive badges | ✅ |

---

## Database Schema (Prisma)

```prisma
model User {
  id                String   @id @default(uuid())
  email             String   @unique
  // ... other fields

  // Subscription fields
  subscriptionTier  SubscriptionTier @default(FREE)
  stripeCustomerId  String?  @unique
  stripeSubscriptionId String?
  subscriptionEndsAt DateTime?

  // Daily game tracking
  gamesPlayedToday  Int      @default(0)
  lastGameResetAt   DateTime @default(now())

  // Relations
  subscription      Subscription?
}

model Subscription {
  id                String   @id @default(uuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])

  stripeSubscriptionId String @unique
  stripePriceId     String
  status            SubscriptionStatus
  currentPeriodStart DateTime
  currentPeriodEnd  DateTime
  cancelAtPeriodEnd Boolean @default(false)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
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
  TRIALING
}
```

---

## Module Structure

```
src/subscriptions/
├── subscriptions.module.ts
├── subscriptions.controller.ts      # REST endpoints
├── subscriptions.service.ts         # Core business logic
├── stripe.service.ts                # Stripe API integration
├── game-limit.service.ts            # Daily game tracking
├── guards/
│   └── subscription.guard.ts        # Route protection
├── decorators/
│   └── requires-pro.decorator.ts    # Mark routes as Pro-only
├── dto/
│   ├── create-checkout.dto.ts
│   ├── subscription-status.dto.ts
│   └── webhook-event.dto.ts
└── entities/
    └── subscription.entity.ts
```

---

## API Endpoints

### REST Endpoints

```typescript
@Controller('subscriptions')
export class SubscriptionsController {
  // Get current user's subscription status
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: User): Promise<SubscriptionStatusDto>

  // Create Stripe checkout session
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @CurrentUser() user: User,
    @Body() dto: CreateCheckoutDto
  ): Promise<{ sessionUrl: string }>

  // Create Stripe customer portal session (manage subscription)
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(@CurrentUser() user: User): Promise<{ portalUrl: string }>

  // Stripe webhook handler
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ): Promise<void>
}
```

### Response DTOs

```typescript
// GET /subscriptions/status
interface SubscriptionStatusDto {
  tier: 'free' | 'pro';
  gamesRemaining: number;      // For free tier
  gamesPlayedToday: number;
  dailyLimit: number;          // 2 for free, Infinity for pro
  resetsAt: string;            // ISO timestamp (midnight UTC)
  subscription?: {
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
}
```

---

## Core Services

### SubscriptionsService

```typescript
@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
  ) {}

  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    const gamesRemaining = user.subscriptionTier === 'PRO'
      ? Infinity
      : Math.max(0, FREE_DAILY_LIMIT - user.gamesPlayedToday);

    return {
      tier: user.subscriptionTier.toLowerCase(),
      gamesRemaining,
      gamesPlayedToday: user.gamesPlayedToday,
      dailyLimit: user.subscriptionTier === 'PRO' ? Infinity : FREE_DAILY_LIMIT,
      resetsAt: this.getNextResetTime(),
      subscription: user.subscription ? {
        status: user.subscription.status,
        currentPeriodEnd: user.subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
      } : undefined,
    };
  }

  async canPlayGame(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Pro users can always play
    if (user.subscriptionTier === 'PRO') {
      return true;
    }

    // Check if daily reset needed
    await this.checkAndResetDailyGames(user);

    // Free users limited to FREE_DAILY_LIMIT games
    return user.gamesPlayedToday < FREE_DAILY_LIMIT;
  }

  async incrementGamesPlayed(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { gamesPlayedToday: { increment: 1 } },
    });
  }

  async checkAndResetDailyGames(user: User): Promise<void> {
    const now = new Date();
    const lastReset = new Date(user.lastGameResetAt);

    // Reset if last reset was before today's midnight UTC
    if (lastReset.toDateString() !== now.toDateString()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          gamesPlayedToday: 0,
          lastGameResetAt: now,
        },
      });
    }
  }
}
```

### GameLimitService

```typescript
@Injectable()
export class GameLimitService {
  private readonly FREE_DAILY_LIMIT = 2;

  async validateAndConsumeGame(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const canPlay = await this.subscriptionsService.canPlayGame(userId);
    
    if (!canPlay) {
      return {
        allowed: false,
        reason: 'Daily free game limit reached. Upgrade to Pro for unlimited games.',
      };
    }

    // Increment counter (actual consumption happens when match starts)
    return { allowed: true };
  }

  async consumeGame(userId: string): Promise<void> {
    await this.subscriptionsService.incrementGamesPlayed(userId);
  }
}
```

---

## Stripe Integration

### StripeService

```typescript
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(configService.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckoutSession(user: User, priceId: string): Promise<string> {
    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      // Update user with customer ID
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.configService.get('CLIENT_URL')}/subscription/success`,
      cancel_url: `${this.configService.get('CLIENT_URL')}/subscription/cancel`,
      metadata: { userId: user.id },
    });

    return session.url;
  }

  async createPortalSession(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get('CLIENT_URL')}/settings`,
    });
    return session.url;
  }
}
```

### Webhook Events

```typescript
@Injectable()
export class WebhookService {
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: subscription.status === 'active' ? 'PRO' : 'FREE',
      },
    });

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = subscription.metadata.userId;
    
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE' },
    });

    await this.prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELED' },
    });
  }
}
```

---

## Guards & Decorators

### SubscriptionGuard

```typescript
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresPro = this.reflector.get<boolean>('requiresPro', context.getHandler());
    
    if (!requiresPro) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user.subscriptionTier !== 'PRO') {
      throw new ForbiddenException('Pro subscription required');
    }

    return true;
  }
}
```

### CanPlayGuard (for matchmaking)

```typescript
@Injectable()
export class CanPlayGuard implements CanActivate {
  constructor(private gameLimitService: GameLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const userId = client.data.userId;

    const { allowed, reason } = await this.gameLimitService.validateAndConsumeGame(userId);
    
    if (!allowed) {
      client.emit('matchmaking:error', { code: 'GAME_LIMIT_REACHED', message: reason });
      return false;
    }

    return true;
  }
}
```

### RequiresPro Decorator

```typescript
export const RequiresPro = () => SetMetadata('requiresPro', true);

// Usage:
@Get('ranked-leaderboard')
@RequiresPro()
async getRankedLeaderboard() { }
```

---

## Matchmaking Integration

The game limit check is integrated into the matchmaking flow:

```typescript
@WebSocketGateway()
export class MatchmakingGateway {
  @SubscribeMessage('matchmaking:join')
  @UseGuards(WsAuthGuard, CanPlayGuard) // CanPlayGuard checks game limit
  async handleJoinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinQueueDto,
  ) {
    // If we get here, user has games remaining or is Pro
    await this.matchmakingService.addToQueue(client.data.userId, payload);
  }
}

@Injectable()
export class MatchmakingService {
  async onMatchFound(player1Id: string, player2Id: string): Promise<void> {
    // Consume a game for free users when match actually starts
    await this.gameLimitService.consumeGame(player1Id);
    await this.gameLimitService.consumeGame(player2Id);
    
    // Create battle...
  }
}
```

---

## Cron Jobs

```typescript
@Injectable()
export class SubscriptionsCron {
  constructor(private subscriptionsService: SubscriptionsService) {}

  // Reset daily game counts at midnight UTC
  @Cron('0 0 * * *', { timeZone: 'UTC' })
  async resetDailyGames(): Promise<void> {
    await this.prisma.user.updateMany({
      where: { subscriptionTier: 'FREE' },
      data: {
        gamesPlayedToday: 0,
        lastGameResetAt: new Date(),
      },
    });
  }

  // Check for expired subscriptions
  @Cron('0 * * * *') // Every hour
  async checkExpiredSubscriptions(): Promise<void> {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lt: new Date() },
      },
    });

    for (const sub of expired) {
      // Stripe webhook should handle this, but this is a fallback
      await this.subscriptionsService.downgradeToFree(sub.userId);
    }
  }
}
```

---

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_MONTHLY=price_xxx
STRIPE_PRICE_ID_YEARLY=price_xxx

# Game limits
FREE_DAILY_GAME_LIMIT=2

# Client URL (for redirect)
CLIENT_URL=https://codequest.gg
```

---

## Testing

```typescript
describe('SubscriptionsService', () => {
  it('should allow Pro users unlimited games', async () => {
    const proUser = { id: '1', subscriptionTier: 'PRO', gamesPlayedToday: 100 };
    expect(await service.canPlayGame(proUser.id)).toBe(true);
  });

  it('should limit free users to 2 games', async () => {
    const freeUser = { id: '2', subscriptionTier: 'FREE', gamesPlayedToday: 2 };
    expect(await service.canPlayGame(freeUser.id)).toBe(false);
  });

  it('should reset games at midnight', async () => {
    // Test daily reset logic
  });
});
```
