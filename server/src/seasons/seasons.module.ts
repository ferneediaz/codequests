import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SeasonsService } from './seasons.service';
import { SeasonsController, UserSeasonsController } from './seasons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), RealtimeModule],
    controllers: [SeasonsController, UserSeasonsController],
    providers: [SeasonsService],
    exports: [SeasonsService],
})
export class SeasonsModule {}
