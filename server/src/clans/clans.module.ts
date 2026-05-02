import { Module } from '@nestjs/common';
import { ClansController } from './clans.controller';
import { ClansService } from './clans.service';
import { ClanChallengeService } from './clan-challenges.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { BattlesModule } from '../battles/battles.module';

@Module({
    imports: [RealtimeModule, BattlesModule],
    controllers: [ClansController],
    providers: [ClansService, ClanChallengeService],
    exports: [ClansService, ClanChallengeService],
})
export class ClansModule { }
