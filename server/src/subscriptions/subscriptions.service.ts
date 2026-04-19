import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatusResponseDto } from './dto/subscription-status-response.dto';

export const FREE_DAILY_LIMIT = 1;
export const TRIAL_DURATION_DAYS = 7;

// Minimal Stripe types for webhook handling (avoids Stripe v22 import issues)
interface StripeWebhookEvent {
  type: string;
  data: { object: any };
}

interface StripeCheckoutSession {
  metadata?: { userId?: string };
  customer?: string | { id: string };
}

interface StripeSubscription {
  id: string;
  metadata?: { userId?: string };
  status: string;
  items: { data: Array<{ price: { id: string } }> };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

interface StripeInvoice {
  subscription?: string | { id: string };
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  /**
   * Check if a user has Pro-level access (paid or trial).
   */
  isTrialActive(trialEndsAt: Date | null): boolean {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt) > new Date();
  }

  /**
   * Start a 7-day free trial for a user.
   */
  async startTrial(userId: string): Promise<{ trialEndsAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.hasUsedTrial) {
      throw new BadRequestException('Free trial has already been used');
    }

    if (user.subscriptionTier === 'PRO') {
      throw new BadRequestException('User already has a Pro subscription');
    }

    const trialEndsAt = new Date();
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + TRIAL_DURATION_DAYS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        trialEndsAt,
        hasUsedTrial: true,
      },
    });

    return { trialEndsAt };
  }

  /**
   * Check if a user can start/join a game.
   * Pro/trial users always can. Free users limited to FREE_DAILY_LIMIT per day.
   */
  async canPlay(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.subscriptionTier === 'PRO' || this.isTrialActive(user.trialEndsAt)) {
      return true;
    }

    // Lazy daily reset check
    await this.checkAndResetDailyGames(user.id, user.lastGameResetAt);

    // Re-fetch after potential reset
    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gamesPlayedToday: true },
    });

    return (updated?.gamesPlayedToday ?? 0) < FREE_DAILY_LIMIT;
  }

  /**
   * Increment the daily games played counter for a user.
   */
  async incrementGamesPlayed(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { gamesPlayedToday: { increment: 1 } },
    });
  }

  /**
   * Reset daily game count if the last reset was before today (UTC).
   */
  async checkAndResetDailyGames(
    userId: string,
    lastGameResetAt: Date,
  ): Promise<void> {
    const now = new Date();
    const lastReset = new Date(lastGameResetAt);

    // Compare dates in UTC
    const lastResetDate = lastReset.toISOString().slice(0, 10);
    const todayDate = now.toISOString().slice(0, 10);

    if (lastResetDate !== todayDate) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          gamesPlayedToday: 0,
          lastGameResetAt: now,
        },
      });
    }
  }

  /**
   * Get current subscription status for a user.
   */
  async getSubscriptionStatus(
    userId: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Lazy reset
    await this.checkAndResetDailyGames(user.id, user.lastGameResetAt);

    const isPro = user.subscriptionTier === 'PRO';
    const onTrial = this.isTrialActive(user.trialEndsAt);
    const hasProAccess = isPro || onTrial;
    let gamesPlayedToday = user.gamesPlayedToday;

    if (!hasProAccess) {
      // Re-fetch after potential reset
      const refreshed = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { gamesPlayedToday: true },
      });
      gamesPlayedToday = refreshed?.gamesPlayedToday ?? 0;
    }

    const gamesRemaining = hasProAccess
      ? -1
      : Math.max(0, FREE_DAILY_LIMIT - gamesPlayedToday);

    // Next midnight UTC
    const now = new Date();
    const resetsAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );

    const tier = isPro ? 'pro' : onTrial ? 'trial' : 'free';

    return {
      tier,
      gamesRemaining,
      gamesPlayedToday,
      dailyLimit: hasProAccess ? -1 : FREE_DAILY_LIMIT,
      resetsAt: resetsAt.toISOString(),
      trialEndsAt: onTrial ? user.trialEndsAt!.toISOString() : undefined,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            currentPeriodEnd:
              user.subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : undefined,
    };
  }

  /**
   * Create a Stripe checkout session for the user.
   */
  async createCheckoutSession(
    userId: string,
    plan: 'bimonthly' | 'yearly',
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      customerId = await this.stripeService.createCustomer(
        user.email,
        user.id,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Resolve price ID from plan type
    const priceId =
      plan === 'yearly'
        ? this.configService.get<string>('STRIPE_PRICE_ID_YEARLY')
        : this.configService.get<string>('STRIPE_PRICE_ID_BIMONTHLY');

    if (!priceId) {
      throw new BadRequestException(
        `Stripe price not configured for plan: ${plan}`,
      );
    }

    return this.stripeService.createCheckoutSession(
      customerId,
      priceId,
      userId,
    );
  }

  /**
   * Create a Stripe customer portal session for managing subscription.
   */
  async createPortalSession(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No active subscription to manage');
    }

    return this.stripeService.createPortalSession(user.stripeCustomerId);
  }

  /**
   * Process incoming Stripe webhook events.
   */
  async handleWebhookEvent(event: StripeWebhookEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as StripeCheckoutSession,
        );
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as StripeSubscription,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as StripeSubscription,
        );
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(
          event.data.object as StripeInvoice,
        );
        break;

      default:
        this.logger.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(
    session: StripeCheckoutSession,
  ): Promise<void> {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn('Checkout session missing userId metadata');
      return;
    }

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (customerId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }
  }

  private async handleSubscriptionUpdated(
    subscription: StripeSubscription,
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn('Subscription missing userId metadata');
      return;
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trialing';

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: isActive ? 'PRO' : 'FREE',
      },
    });

    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0].price.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(
          subscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      update: {
        stripePriceId: subscription.items.data[0].price.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(
          subscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  }

  private async handleSubscriptionDeleted(
    subscription: StripeSubscription,
  ): Promise<void> {
    const userId = subscription.metadata?.userId;
    if (!userId) {
      this.logger.warn('Subscription deletion missing userId metadata');
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'FREE' },
    });

    try {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'CANCELED' },
      });
    } catch {
      this.logger.warn(
        `Subscription record not found for ${subscription.id} during deletion`,
      );
    }
  }

  private async handlePaymentFailed(invoice: StripeInvoice): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subscriptionId) return;

    try {
      await this.prisma.subscription.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: { status: 'PAST_DUE' },
      });
    } catch {
      this.logger.warn(
        `Subscription record not found for ${subscriptionId} during payment failure`,
      );
    }
  }

  private mapStripeStatus(
    status: string,
  ): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'ACTIVE';
      case 'canceled':
        return 'CANCELED';
      case 'past_due':
        return 'PAST_DUE';
      case 'unpaid':
        return 'UNPAID';
      default:
        return 'ACTIVE';
    }
  }

  /**
   * Cron: Reset all free users' daily game counts at midnight UTC.
   */
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
}
