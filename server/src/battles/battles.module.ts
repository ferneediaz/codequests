import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BattlesService } from './battles.service';
import { BattleRoyaleService } from './battle-royale.service';
import { BattlesController } from './battles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SeasonsModule } from '../seasons/seasons.module';
import { ProblemsModule } from '../problems/problems.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
    imports: [
        PrismaModule,
        CodeExecutionModule,
        SubscriptionsModule,
        SeasonsModule,
        ProblemsModule,
        ScheduleModule.forRoot(),
        forwardRef(() => WebsocketsModule),
    ],
    controllers: [BattlesController],
    providers: [BattlesService, BattleRoyaleService],
    exports: [BattlesService, BattleRoyaleService],
})
export class BattlesModule { }
