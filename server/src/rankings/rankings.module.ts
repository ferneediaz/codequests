import { Module } from '@nestjs/common';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { FriendsModule } from '../friends/friends.module';

// PrismaModule is @Global() — do not re-import.
@Module({
  imports: [FriendsModule],
  controllers: [RankingsController],
  providers: [RankingsService],
})
export class RankingsModule {}
