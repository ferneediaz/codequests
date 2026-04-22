import { Module } from '@nestjs/common';
import { AuthoringController } from './authoring.controller';
import { CodeExecutionModule } from '../../code-execution/code-execution.module';

@Module({
    imports: [CodeExecutionModule],
    controllers: [AuthoringController],
})
export class AuthoringModule {}
