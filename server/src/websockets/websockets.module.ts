import { Module, forwardRef } from '@nestjs/common';
import { BattlesGateway } from './battles.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { BattlesModule } from '../battles/battles.module';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
    imports: [PrismaModule, forwardRef(() => BattlesModule), AuthModule, forwardRef(() => FriendsModule)],
    providers: [BattlesGateway, WsAuthGuard],
    exports: [BattlesGateway],
})
export class WebsocketsModule { }
