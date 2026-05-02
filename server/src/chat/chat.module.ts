import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { WsAuthGuard } from '../websockets/ws-auth.guard';

@Module({
    imports: [AuthModule, FriendsModule],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway, WsAuthGuard],
    exports: [ChatService, ChatGateway],
})
export class ChatModule {}
