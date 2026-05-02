import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BattlesService } from './battles.service';
import { BattleRoyaleService } from './battle-royale.service';
import { ClanWarsService } from './clan-wars.service';
import { BattlesController } from './battles.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SeasonsModule } from '../seasons/seasons.module';
import { ProblemsModule } from '../problems/problems.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
    imports: [
        PrismaModule,
        CodeExecutionModule,
        SubscriptionsModule,
        SeasonsModule,
        ProblemsModule,
        ScheduleModule.forRoot(),
        // RealtimeModule (one-way) replaces the old forwardRef on
        // WebsocketsModule. The remaining provider cycle now lives only
        // inside WebsocketsModule, where the gateway needs BattlesService
        // for socket commands (useSkill, readyUp).
        RealtimeModule,
    ],
    controllers: [BattlesController],
    providers: [BattlesService, BattleRoyaleService, ClanWarsService],
    exports: [BattlesService, BattleRoyaleService, ClanWarsService],
})
export class BattlesModule { }
