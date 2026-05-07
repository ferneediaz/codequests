import { Module } from '@nestjs/common';
import { ProblemSubmissionsController } from './problem-submissions.controller';
import { ProblemSubmissionsService } from './problem-submissions.service';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
    imports: [CodeExecutionModule, RealtimeModule, AchievementsModule],
    controllers: [ProblemSubmissionsController],
    providers: [ProblemSubmissionsService],
})
export class ProblemSubmissionsModule {}
