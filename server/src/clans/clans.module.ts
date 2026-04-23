import { Module, forwardRef } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ClanChallengeService } from './clan-challenges.service';
import { WebsocketsModule } from '../websockets/websockets.module';
import { BattlesModule } from '../battles/battles.module';

@Module({
    imports: [
        forwardRef(() => WebsocketsModule),
        forwardRef(() => BattlesModule),
    ],
    controllers: [ClansController],
    providers: [ClansService, ClanChallengeService],
    exports: [ClansService, ClanChallengeService],
})
export class ClansModule { }
