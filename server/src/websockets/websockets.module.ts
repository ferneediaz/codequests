import { Module, forwardRef } from '@nestjs/common';
import { BattlesGateway } from './battles.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { BattlesModule } from '../battles/battles.module';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';

// Residual cycle: BattlesGateway needs BattlesService for socket commands
// (useSkill, readyUp, invites) and FriendsService for friend presence
// pings. Both feature modules now consume the gateway only via the
// realtime ports (RealtimeModule), but they still expose the services we
// inject here, so the cycle is one-sided and broken with forwardRef.
@Module({
    imports: [
        PrismaModule,
        AuthModule,
        forwardRef(() => BattlesModule),
        forwardRef(() => FriendsModule),
    ],
    providers: [BattlesGateway, WsAuthGuard],
    exports: [BattlesGateway],
})
export class WebsocketsModule { }
