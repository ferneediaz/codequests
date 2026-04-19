import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, StripeService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
