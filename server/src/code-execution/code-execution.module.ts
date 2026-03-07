import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CodeExecutionService } from './code-execution.service';
import { PistonClient } from './piston.client';

@Module({
  imports: [ConfigModule],
  providers: [CodeExecutionService, PistonClient],
  exports: [CodeExecutionService],
})
export class CodeExecutionModule { }
