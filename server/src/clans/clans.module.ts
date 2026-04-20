import { Module, forwardRef } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ClanChallengeService } from './clan-challenges.service';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
    imports: [forwardRef(() => WebsocketsModule)],
    controllers: [ClansController],
    providers: [ClansService, ClanChallengeService],
    exports: [ClansService, ClanChallengeService],
})
export class ClansModule { }
