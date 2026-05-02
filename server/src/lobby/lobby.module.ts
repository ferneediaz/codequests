import { Module } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BattlesModule } from '../battles/battles.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
    imports: [PrismaModule, RealtimeModule, BattlesModule, FriendsModule],
    controllers: [LobbyController],
    providers: [LobbyService],
    exports: [LobbyService],
})
export class LobbyModule {}
