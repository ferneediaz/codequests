import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: InstanceType<typeof Stripe>;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!apiKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — StripeService running in disabled mode. Subscription endpoints will throw at runtime.',
      );
      // Placeholder key so constructor does not throw; any actual API call will fail.
      this.stripe = new Stripe('sk_test_disabled_placeholder');
      return;
    }
    this.stripe = new Stripe(apiKey);
  }

  private ensureConfigured(): void {
    if (!this.configService.get<string>('STRIPE_SECRET_KEY')) {
      throw new InternalServerErrorException(
        'Stripe is not configured on this server (missing STRIPE_SECRET_KEY).',
      );
    }
  }

  async createCustomer(email: string, userId: string): Promise<string> {
    this.ensureConfigured();
    const customer = await this.stripe.customers.create({
      email,
      metadata: { userId },
    });
    return customer.id;
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    userId: string,
  ): Promise<string> {
    this.ensureConfigured();
    const clientUrl = this.configService.get<string>('CLIENT_URL') || 'http://localhost:5173';

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${clientUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/subscription/cancel`,
      metadata: { userId },
    });

    if (!session.url) {
      throw new InternalServerErrorException('Stripe did not return a checkout session URL');
    }

    return session.url;
  }

  async createPortalSession(customerId: string): Promise<string> {
    this.ensureConfigured();
    const clientUrl = this.configService.get<string>('CLIENT_URL') || 'http://localhost:5173';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${clientUrl}/settings`,
    });

    return session.url;
  }

  constructWebhookEvent(
    body: Buffer,
    signature: string,
  ): any {
    this.ensureConfigured();
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET')!;
    return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
  }
}
