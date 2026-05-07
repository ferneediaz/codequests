import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService, FREE_DAILY_LIMIT, TRIAL_DURATION_DAYS } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import {
    createMockPrismaService,
    MockPrismaService,
} from '../__mocks__/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SubscriptionsService', () => {
    let service: SubscriptionsService;
    let prisma: MockPrismaService;
    let stripeService: jest.Mocked<StripeService>;
    let configService: jest.Mocked<ConfigService>;

    const mockFreeUser = {
        id: 'user-free',
        email: 'free@test.com',
        username: 'freeuser',
        subscriptionTier: 'FREE',
        stripeCustomerId: null,
        gamesPlayedToday: 0,
        lastGameResetAt: new Date(),
        trialEndsAt: null,
        hasUsedTrial: false,
        subscription: null,
        mmr: 1000,
        wins: 0,
        losses: 0,
    };

    const mockProUser = {
        id: 'user-pro',
        email: 'pro@test.com',
        username: 'prouser',
        subscriptionTier: 'PRO',
        stripeCustomerId: 'cus_123',
        gamesPlayedToday: 50,
        lastGameResetAt: new Date(),
        trialEndsAt: null,
        hasUsedTrial: false,
        subscription: {
            id: 'sub-1',
            userId: 'user-pro',
            stripeSubscriptionId: 'sub_stripe_123',
            stripePriceId: 'price_bimonthly',
            status: 'ACTIVE',
            currentPeriodStart: new Date('2026-04-01'),
            currentPeriodEnd: new Date('2026-06-01'),
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        mmr: 1500,
        wins: 20,
        losses: 5,
    };

    beforeEach(async () => {
        const mockPrisma = createMockPrismaService();

        const mockStripeService = {
            createCustomer: jest.fn(),
            createCheckoutSession: jest.fn(),
            createPortalSession: jest.fn(),
            constructWebhookEvent: jest.fn(),
        };

        const mockConfigService = {
            get: jest.fn((key: string) => {
                const config: Record<string, string> = {
                    STRIPE_PRICE_ID_BIMONTHLY: 'price_bimonthly',
                    STRIPE_PRICE_ID_YEARLY: 'price_yearly',
                    CLIENT_URL: 'http://localhost:5173',
                    // Dev pro allowlist defaults to empty so existing tests
                    // exercise the real free/pro/trial paths unchanged.
                    DEV_PRO_USER_IDS: '',
                    DEV_PRO_EMAILS: '',
                };
                return config[key];
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionsService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: StripeService, useValue: mockStripeService },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<SubscriptionsService>(SubscriptionsService);
        prisma = mockPrisma as unknown as MockPrismaService;
        stripeService = mockStripeService as unknown as jest.Mocked<StripeService>;
        configService = mockConfigService as unknown as jest.Mocked<ConfigService>;
    });

    // =========================================
    // canPlay tests
    // =========================================

    describe('canPlay', () => {
        it('should allow Pro users regardless of games played', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);
            expect(await service.canPlay('user-pro')).toBe(true);
        });

        it('should allow free users with 0 games played today', async () => {
            prisma.user.findUnique
                .mockResolvedValueOnce(mockFreeUser)
                .mockResolvedValueOnce({ gamesPlayedToday: 0 });
            expect(await service.canPlay('user-free')).toBe(true);
        });

        it('should block free users who reached the daily limit', async () => {
            const userAtLimit = { ...mockFreeUser, gamesPlayedToday: 1 };
            prisma.user.findUnique
                .mockResolvedValueOnce(userAtLimit)
                .mockResolvedValueOnce({ gamesPlayedToday: 1 });
            expect(await service.canPlay('user-free')).toBe(false);
        });

        it('should throw NotFoundException for missing user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(service.canPlay('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should reset games and allow play if last reset was yesterday', async () => {
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const userYesterday = {
                ...mockFreeUser,
                gamesPlayedToday: 1,
                lastGameResetAt: yesterday,
            };
            prisma.user.findUnique
                .mockResolvedValueOnce(userYesterday)
                .mockResolvedValueOnce({ gamesPlayedToday: 0 });
            prisma.user.update.mockResolvedValue({ ...userYesterday, gamesPlayedToday: 0 });

            expect(await service.canPlay('user-free')).toBe(true);
            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'user-free' },
                    data: expect.objectContaining({ gamesPlayedToday: 0 }),
                }),
            );
        });
        it('should allow users on active trial regardless of games played', async () => {
            const trialUser = {
                ...mockFreeUser,
                gamesPlayedToday: 5,
                trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
                hasUsedTrial: true,
            };
            prisma.user.findUnique.mockResolvedValue(trialUser);
            expect(await service.canPlay('user-free')).toBe(true);
        });

        it('should block users with expired trial at the daily limit', async () => {
            const expiredTrialUser = {
                ...mockFreeUser,
                gamesPlayedToday: 1,
                trialEndsAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
                hasUsedTrial: true,
            };
            prisma.user.findUnique
                .mockResolvedValueOnce(expiredTrialUser)
                .mockResolvedValueOnce({ gamesPlayedToday: 1 });
            expect(await service.canPlay('user-free')).toBe(false);
        });
    });

    // =========================================
    // isTrialActive tests
    // =========================================

    describe('isTrialActive', () => {
        it('should return true when trial is in the future', () => {
            const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            expect(service.isTrialActive(future)).toBe(true);
        });

        it('should return false when trial has expired', () => {
            const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
            expect(service.isTrialActive(past)).toBe(false);
        });

        it('should return false when trialEndsAt is null', () => {
            expect(service.isTrialActive(null)).toBe(false);
        });
    });

    // =========================================
    // startTrial tests
    // =========================================

    describe('startTrial', () => {
        it('should activate a 7-day trial for a free user', async () => {
            prisma.user.findUnique.mockResolvedValue(mockFreeUser);
            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                hasUsedTrial: true,
                trialEndsAt: new Date(),
            });

            const result = await service.startTrial('user-free');

            expect(result.trialEndsAt).toBeInstanceOf(Date);
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: expect.objectContaining({
                    hasUsedTrial: true,
                }),
            });
        });

        it('should throw if user has already used trial', async () => {
            const usedTrialUser = { ...mockFreeUser, hasUsedTrial: true };
            prisma.user.findUnique.mockResolvedValue(usedTrialUser);

            await expect(service.startTrial('user-free')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw if user already has Pro subscription', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);

            await expect(service.startTrial('user-pro')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should throw NotFoundException for missing user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.startTrial('nonexistent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('incrementGamesPlayed', () => {
        it('should increment gamesPlayedToday', async () => {
            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                gamesPlayedToday: 1,
            });

            await service.incrementGamesPlayed('user-free');

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: { gamesPlayedToday: { increment: 1 } },
            });
        });
    });

    // =========================================
    // checkAndResetDailyGames tests
    // =========================================

    describe('checkAndResetDailyGames', () => {
        it('should reset when last reset was yesterday', async () => {
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            prisma.user.update.mockResolvedValue(mockFreeUser);

            await service.checkAndResetDailyGames('user-free', yesterday);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: expect.objectContaining({
                    gamesPlayedToday: 0,
                }),
            });
        });

        it('should not reset when last reset was today', async () => {
            const today = new Date();

            await service.checkAndResetDailyGames('user-free', today);

            expect(prisma.user.update).not.toHaveBeenCalled();
        });
    });

    // =========================================
    // getSubscriptionStatus tests
    // =========================================

    describe('getSubscriptionStatus', () => {
        it('should return free user status with correct gamesRemaining', async () => {
            prisma.user.findUnique
                .mockResolvedValueOnce(mockFreeUser)
                .mockResolvedValueOnce({ gamesPlayedToday: 0 });

            const status = await service.getSubscriptionStatus('user-free');

            expect(status.tier).toBe('free');
            expect(status.gamesRemaining).toBe(FREE_DAILY_LIMIT);
            expect(status.gamesPlayedToday).toBe(0);
            expect(status.dailyLimit).toBe(FREE_DAILY_LIMIT);
            expect(status.subscription).toBeUndefined();
        });

        it('should return pro user status with unlimited', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);

            const status = await service.getSubscriptionStatus('user-pro');

            expect(status.tier).toBe('pro');
            expect(status.gamesRemaining).toBe(-1);
            expect(status.dailyLimit).toBe(-1);
            expect(status.subscription).toBeDefined();
            expect(status.subscription!.status).toBe('ACTIVE');
            expect(status.subscription!.cancelAtPeriodEnd).toBe(false);
        });

        it('should throw NotFoundException for missing user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(
                service.getSubscriptionStatus('nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should return trial user status with unlimited games', async () => {
            const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            const trialUser = {
                ...mockFreeUser,
                trialEndsAt,
                hasUsedTrial: true,
            };
            prisma.user.findUnique.mockResolvedValue(trialUser);

            const status = await service.getSubscriptionStatus('user-free');

            expect(status.tier).toBe('trial');
            expect(status.gamesRemaining).toBe(-1);
            expect(status.dailyLimit).toBe(-1);
            expect(status.trialEndsAt).toBe(trialEndsAt.toISOString());
        });
    });

    // =========================================
    // createCheckoutSession tests
    // =========================================

    describe('createCheckoutSession', () => {
        it('should create Stripe customer if none exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockFreeUser);
            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                stripeCustomerId: 'cus_new',
            });
            stripeService.createCustomer.mockResolvedValue('cus_new');
            stripeService.createCheckoutSession.mockResolvedValue(
                'https://checkout.stripe.com/session123',
            );

            const url = await service.createCheckoutSession(
                'user-free',
                'bimonthly',
            );

            expect(stripeService.createCustomer).toHaveBeenCalledWith(
                'free@test.com',
                'user-free',
            );
            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: { stripeCustomerId: 'cus_new' },
            });
            expect(url).toBe('https://checkout.stripe.com/session123');
        });

        it('should reuse existing Stripe customer', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);
            stripeService.createCheckoutSession.mockResolvedValue(
                'https://checkout.stripe.com/session456',
            );

            await service.createCheckoutSession('user-pro', 'yearly');

            expect(stripeService.createCustomer).not.toHaveBeenCalled();
            expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
                'cus_123',
                'price_yearly',
                'user-pro',
            );
        });

        it('should use bimonthly price ID for bimonthly plan', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);
            stripeService.createCheckoutSession.mockResolvedValue('url');

            await service.createCheckoutSession('user-pro', 'bimonthly');

            expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
                'cus_123',
                'price_bimonthly',
                'user-pro',
            );
        });

        it('should throw NotFoundException for missing user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(
                service.createCheckoutSession('nonexistent', 'bimonthly'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException if price not configured', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);
            configService.get.mockReturnValue(undefined);

            await expect(
                service.createCheckoutSession('user-pro', 'yearly'),
            ).rejects.toThrow(BadRequestException);
        });
    });

    // =========================================
    // createPortalSession tests
    // =========================================

    describe('createPortalSession', () => {
        it('should create portal session for user with Stripe customer', async () => {
            prisma.user.findUnique.mockResolvedValue(mockProUser);
            stripeService.createPortalSession.mockResolvedValue(
                'https://billing.stripe.com/portal123',
            );

            const url = await service.createPortalSession('user-pro');

            expect(url).toBe('https://billing.stripe.com/portal123');
            expect(stripeService.createPortalSession).toHaveBeenCalledWith(
                'cus_123',
            );
        });

        it('should throw BadRequestException if no Stripe customer', async () => {
            prisma.user.findUnique.mockResolvedValue(mockFreeUser);
            await expect(
                service.createPortalSession('user-free'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException for missing user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);
            await expect(
                service.createPortalSession('nonexistent'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    // =========================================
    // handleWebhookEvent tests
    // =========================================

    describe('handleWebhookEvent', () => {
        it('should handle checkout.session.completed — link customer', async () => {
            const event = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        metadata: { userId: 'user-free' },
                        customer: 'cus_new_checkout',
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                stripeCustomerId: 'cus_new_checkout',
            });

            await service.handleWebhookEvent(event);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: { stripeCustomerId: 'cus_new_checkout' },
            });
        });

        it('should handle customer.subscription.created — set tier to PRO', async () => {
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_new',
                        metadata: { userId: 'user-free' },
                        status: 'active',
                        items: { data: [{ price: { id: 'price_bimonthly' } }] },
                        current_period_start: Math.floor(Date.now() / 1000),
                        current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60,
                        cancel_at_period_end: false,
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                subscriptionTier: 'PRO',
            });
            prisma.subscription.upsert.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: { subscriptionTier: 'PRO' },
            });
            expect(prisma.subscription.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { stripeSubscriptionId: 'sub_new' },
                    create: expect.objectContaining({
                        userId: 'user-free',
                        status: 'ACTIVE',
                    }),
                }),
            );
        });

        it('should handle customer.subscription.updated — update status', async () => {
            const event = {
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_stripe_123',
                        metadata: { userId: 'user-pro' },
                        status: 'active',
                        items: { data: [{ price: { id: 'price_yearly' } }] },
                        current_period_start: Math.floor(Date.now() / 1000),
                        current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
                        cancel_at_period_end: true,
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue(mockProUser);
            prisma.subscription.upsert.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.subscription.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({
                        cancelAtPeriodEnd: true,
                    }),
                }),
            );
        });

        it('should handle customer.subscription.deleted — set tier to FREE', async () => {
            const event = {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_stripe_123',
                        metadata: { userId: 'user-pro' },
                        status: 'canceled',
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockProUser,
                subscriptionTier: 'FREE',
            });
            prisma.subscription.update.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-pro' },
                data: { subscriptionTier: 'FREE' },
            });
            expect(prisma.subscription.update).toHaveBeenCalledWith({
                where: { stripeSubscriptionId: 'sub_stripe_123' },
                data: { status: 'CANCELED' },
            });
        });

        it('should handle invoice.payment_failed — set status to PAST_DUE', async () => {
            const event = {
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        subscription: 'sub_stripe_123',
                    },
                },
            } as any;

            prisma.subscription.update.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.subscription.update).toHaveBeenCalledWith({
                where: { stripeSubscriptionId: 'sub_stripe_123' },
                data: { status: 'PAST_DUE' },
            });
        });

        it('should skip unknown event types without error', async () => {
            const event = {
                type: 'some.unknown.event',
                data: { object: {} },
            } as any;

            await expect(
                service.handleWebhookEvent(event),
            ).resolves.not.toThrow();
        });

        it('should skip checkout.session.completed if no userId in metadata', async () => {
            const event = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        metadata: {},
                        customer: 'cus_orphan',
                    },
                },
            } as any;

            await service.handleWebhookEvent(event);

            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('should read current_period_start/end from items.data[0] (Stripe API >= 2025-04-30 schema)', async () => {
            const periodStart = Math.floor(Date.now() / 1000);
            const periodEnd = periodStart + 60 * 60 * 24 * 60;
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_item_level',
                        metadata: { userId: 'user-free' },
                        status: 'active',
                        items: {
                            data: [
                                {
                                    price: { id: 'price_bimonthly' },
                                    current_period_start: periodStart,
                                    current_period_end: periodEnd,
                                },
                            ],
                        },
                        // Top-level fields intentionally omitted to simulate
                        // the post-2025-04-30 Stripe API payload.
                        cancel_at_period_end: false,
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                subscriptionTier: 'PRO',
            });
            prisma.subscription.upsert.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.subscription.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        currentPeriodStart: new Date(periodStart * 1000),
                        currentPeriodEnd: new Date(periodEnd * 1000),
                    }),
                }),
            );
        });

        it('should skip DB upsert when both top-level and item-level period dates are missing', async () => {
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_no_period',
                        metadata: { userId: 'user-free' },
                        status: 'active',
                        items: { data: [{ price: { id: 'price_bimonthly' } }] },
                        cancel_at_period_end: false,
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                subscriptionTier: 'PRO',
            });

            await expect(
                service.handleWebhookEvent(event),
            ).resolves.not.toThrow();

            expect(prisma.subscription.upsert).not.toHaveBeenCalled();
        });

        it('should skip DB upsert when subscription has no line items', async () => {
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_no_items',
                        metadata: { userId: 'user-free' },
                        status: 'active',
                        items: { data: [] },
                        current_period_start: Math.floor(Date.now() / 1000),
                        current_period_end:
                            Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 60,
                        cancel_at_period_end: false,
                    },
                },
            } as any;

            await expect(
                service.handleWebhookEvent(event),
            ).resolves.not.toThrow();

            expect(prisma.subscription.upsert).not.toHaveBeenCalled();
        });

        it('should handle trialing subscription status — set tier to PRO', async () => {
            const event = {
                type: 'customer.subscription.created',
                data: {
                    object: {
                        id: 'sub_trial',
                        metadata: { userId: 'user-free' },
                        status: 'trialing',
                        items: { data: [{ price: { id: 'price_bimonthly' } }] },
                        current_period_start: Math.floor(Date.now() / 1000),
                        current_period_end: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
                        cancel_at_period_end: false,
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockFreeUser,
                subscriptionTier: 'PRO',
            });
            prisma.subscription.upsert.mockResolvedValue({});

            await service.handleWebhookEvent(event);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: 'user-free' },
                data: { subscriptionTier: 'PRO' },
            });
            expect(prisma.subscription.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        status: 'ACTIVE',
                    }),
                }),
            );
        });

        it('should not crash if subscription record missing on deletion', async () => {
            const event = {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_nonexistent',
                        metadata: { userId: 'user-pro' },
                        status: 'canceled',
                    },
                },
            } as any;

            prisma.user.update.mockResolvedValue({
                ...mockProUser,
                subscriptionTier: 'FREE',
            });
            prisma.subscription.update.mockRejectedValue(
                new Error('Record not found'),
            );

            await expect(
                service.handleWebhookEvent(event),
            ).resolves.not.toThrow();
        });

        it('should not crash if subscription record missing on payment failure', async () => {
            const event = {
                type: 'invoice.payment_failed',
                data: {
                    object: {
                        subscription: 'sub_nonexistent',
                    },
                },
            } as any;

            prisma.subscription.update.mockRejectedValue(
                new Error('Record not found'),
            );

            await expect(
                service.handleWebhookEvent(event),
            ).resolves.not.toThrow();
        });
    });

    // =========================================
    // resetAllDailyGameCounts tests
    // =========================================

    describe('resetAllDailyGameCounts', () => {
        it('should reset game counts for all free users', async () => {
            prisma.user.updateMany.mockResolvedValue({ count: 42 });

            await service.resetAllDailyGameCounts();

            expect(prisma.user.updateMany).toHaveBeenCalledWith({
                where: { subscriptionTier: 'FREE' },
                data: expect.objectContaining({
                    gamesPlayedToday: 0,
                }),
            });
        });
    });

    // =========================================
    // Constants
    // =========================================

    describe('constants', () => {
        it('should have FREE_DAILY_LIMIT of 1', () => {
            expect(FREE_DAILY_LIMIT).toBe(1);
        });

        it('should have TRIAL_DURATION_DAYS of 7', () => {
            expect(TRIAL_DURATION_DAYS).toBe(7);
        });
    });

    // =========================================
    // Dev Pro allowlist
    // =========================================

    describe('dev pro allowlist', () => {
        function withDevPro(overrides: {
            DEV_PRO_USER_IDS?: string;
            DEV_PRO_EMAILS?: string;
        }) {
            const config: Record<string, string> = {
                STRIPE_PRICE_ID_BIMONTHLY: 'price_bimonthly',
                STRIPE_PRICE_ID_YEARLY: 'price_yearly',
                CLIENT_URL: 'http://localhost:5173',
                DEV_PRO_USER_IDS: '',
                DEV_PRO_EMAILS: '',
                ...overrides,
            };
            configService.get.mockImplementation((key: string) => config[key]);
        }

        it('canPlay returns true via DEV_PRO_USER_IDS even at the limit', async () => {
            withDevPro({ DEV_PRO_USER_IDS: 'user-free,other-id' });
            const userAtLimit = { ...mockFreeUser, gamesPlayedToday: 1 };
            prisma.user.findUnique.mockResolvedValue(userAtLimit);

            expect(await service.canPlay('user-free')).toBe(true);
            // No games-counter mutation should happen on the dev path.
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('canPlay returns true via DEV_PRO_EMAILS (case-insensitive)', async () => {
            withDevPro({ DEV_PRO_EMAILS: 'FREE@test.com' });
            const userAtLimit = { ...mockFreeUser, gamesPlayedToday: 1 };
            prisma.user.findUnique.mockResolvedValue(userAtLimit);

            expect(await service.canPlay('user-free')).toBe(true);
        });

        it('canPlay falls back to free behavior when allowlist does not match', async () => {
            withDevPro({ DEV_PRO_USER_IDS: 'someone-else' });
            const userAtLimit = { ...mockFreeUser, gamesPlayedToday: 1 };
            prisma.user.findUnique
                .mockResolvedValueOnce(userAtLimit)
                .mockResolvedValueOnce({ gamesPlayedToday: 1 });

            expect(await service.canPlay('user-free')).toBe(false);
        });

        it('getSubscriptionStatus reports tier=pro and source=dev for allowlisted user', async () => {
            withDevPro({ DEV_PRO_USER_IDS: 'user-free' });
            // No subscription row in DB; dev allowlist still grants Pro.
            prisma.user.findUnique.mockResolvedValue(mockFreeUser);

            const status = await service.getSubscriptionStatus('user-free');

            expect(status.tier).toBe('pro');
            expect(status.source).toBe('dev');
            expect(status.gamesRemaining).toBe(-1);
            expect(status.dailyLimit).toBe(-1);
            expect(status.subscription).toBeUndefined();
        });

        it('getSubscriptionStatus reports source=stripe for real Pro users', async () => {
            withDevPro({}); // no allowlist
            prisma.user.findUnique.mockResolvedValue(mockProUser);

            const status = await service.getSubscriptionStatus('user-pro');

            expect(status.tier).toBe('pro');
            expect(status.source).toBe('stripe');
        });
    });
});
