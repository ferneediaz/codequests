import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');

@Injectable()
export class StripeService {
  private stripe: InstanceType<typeof Stripe>;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!);
  }

  async createCustomer(email: string, userId: string): Promise<string> {
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
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET')!;
    return this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
  }
}
