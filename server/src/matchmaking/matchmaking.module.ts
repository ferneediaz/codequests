import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingController } from './matchmaking.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BattlesModule } from '../battles/battles.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
    imports: [PrismaModule, BattlesModule, WebsocketsModule, ScheduleModule.forRoot()],
    controllers: [MatchmakingController],
    providers: [MatchmakingService],
    exports: [MatchmakingService],
})
export class MatchmakingModule {}
