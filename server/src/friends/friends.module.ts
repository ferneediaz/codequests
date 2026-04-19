import { Module, forwardRef } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
    imports: [forwardRef(() => WebsocketsModule)],
    controllers: [FriendsController],
    providers: [FriendsService],
    exports: [FriendsService],
})
export class FriendsModule {}
