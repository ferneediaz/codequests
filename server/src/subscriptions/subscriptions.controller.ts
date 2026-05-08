import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { SubscriptionStatusResponseDto } from './dto/subscription-status-response.dto';
import { AuthedRequest } from '../common/types/authed-request';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
  ) {}

  @Get('status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, type: SubscriptionStatusResponseDto })
  async getStatus(@Req() req: AuthedRequest): Promise<SubscriptionStatusResponseDto> {
    const userId = req.user.id;
    return this.subscriptionsService.getSubscriptionStatus(userId);
  }

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @ApiResponse({ status: 201, description: 'Returns checkout session URL' })
  @ApiBody({ type: CreateCheckoutDto })
  async createCheckout(
    @Req() req: AuthedRequest,
    @Body() dto: CreateCheckoutDto,
  ): Promise<{ sessionUrl: string }> {
    const userId = req.user.id;
    const sessionUrl = await this.subscriptionsService.createCheckoutSession(
      userId,
      dto.plan,
    );
    return { sessionUrl };
  }

  @Post('portal')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  @ApiResponse({ status: 201, description: 'Returns portal session URL' })
  async createPortal(@Req() req: AuthedRequest): Promise<{ portalUrl: string }> {
    const userId = req.user.id;
    const portalUrl = await this.subscriptionsService.createPortalSession(userId);
    return { portalUrl };
  }

  @Post('trial')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start a 7-day free trial' })
  @ApiResponse({ status: 201, description: 'Trial activated' })
  async startTrial(@Req() req: AuthedRequest): Promise<{ trialEndsAt: Date }> {
    const userId = req.user.id;
    return this.subscriptionsService.startTrial(userId);
  }

  @Post('webhook')
  @SkipThrottle()
  @ApiOperation({ summary: 'Stripe webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Raw body not available');
    }

    const event = this.stripeService.constructWebhookEvent(
      req.rawBody,
      signature,
    );

    await this.subscriptionsService.handleWebhookEvent(event);

    return { received: true };
  }
}
