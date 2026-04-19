import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SeasonsService } from './seasons.service';
import { SeasonsController, UserSeasonsController } from './seasons.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
    imports: [PrismaModule, ScheduleModule.forRoot(), forwardRef(() => WebsocketsModule)],
    controllers: [SeasonsController, UserSeasonsController],
    providers: [SeasonsService],
    exports: [SeasonsService],
})
export class SeasonsModule {}
