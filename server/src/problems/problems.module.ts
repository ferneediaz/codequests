import { Module } from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { ProblemsController } from './problems.controller';
import { CodeExecutionModule } from '../code-execution/code-execution.module';

@Module({
  imports: [CodeExecutionModule],
  providers: [ProblemsService],
  controllers: [ProblemsController]
})
export class ProblemsModule { }
