import { Module } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';
import { PistonClient } from './piston.client';

@Module({
  providers: [CodeExecutionService, PistonClient],
  exports: [CodeExecutionService],
})
export class CodeExecutionModule { }
