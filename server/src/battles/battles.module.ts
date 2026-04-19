import { Module } from '@nestjs/common';
import { BattlesService } from './battles.service';
import { BattlesController } from './battles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
    imports: [PrismaModule, CodeExecutionModule, SubscriptionsModule],
    controllers: [BattlesController],
    providers: [BattlesService],
    exports: [BattlesService],
})
export class BattlesModule { }
