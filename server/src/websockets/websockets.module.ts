import { Module } from '@nestjs/common';
import { BattlesGateway } from './battles.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { BattlesModule } from '../battles/battles.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [PrismaModule, BattlesModule, AuthModule],
    providers: [BattlesGateway, WsAuthGuard],
    exports: [BattlesGateway],
})
export class WebsocketsModule {}
