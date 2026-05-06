import { Module } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ClanChallengeService } from './clan-challenges.service';
import { ClanJoinRequestsService } from './clan-join-requests.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { BattlesModule } from '../battles/battles.module';

@Module({
    imports: [RealtimeModule, BattlesModule],
    controllers: [ClansController],
    providers: [ClansService, ClanChallengeService, ClanJoinRequestsService],
    exports: [ClansService, ClanChallengeService, ClanJoinRequestsService],
})
export class ClansModule { }
