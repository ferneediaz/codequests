import { Module, forwardRef } from '@nestjs/common';
import { LobbyController } from './lobby.controller';
import { LobbyService } from './lobby.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebsocketsModule } from '../websockets/websockets.module';
import { BattlesModule } from '../battles/battles.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
    imports: [
        PrismaModule,
        forwardRef(() => WebsocketsModule),
        forwardRef(() => BattlesModule),
        forwardRef(() => FriendsModule),
    ],
    controllers: [LobbyController],
    providers: [LobbyService],
    exports: [LobbyService],
})
export class LobbyModule {}
