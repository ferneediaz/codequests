import { Module, forwardRef } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { RealtimeModule } from '../realtime/realtime.module';

// Why forwardRef around RealtimeModule:
//   FriendsModule -> RealtimeModule -> WebsocketsModule -> FriendsModule
// is a JS-level circular import. WebsocketsModule statically imports
// FriendsModule (to use it inside its own `forwardRef`), so by the time
// CJS evaluates this file mid-cycle, RealtimeModule's class binding is
// still undefined. forwardRef captures the module reference lazily via
// the realtime module namespace object, which is fully populated by
// the time Nest resolves it.
@Module({
    imports: [forwardRef(() => RealtimeModule)],
    controllers: [FriendsController],
    providers: [FriendsService],
    exports: [FriendsService],
})
export class FriendsModule {}
