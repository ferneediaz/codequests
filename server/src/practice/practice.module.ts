import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CodeExecutionModule } from '../code-execution/code-execution.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PracticeService } from './practice.service';
import { PracticeController } from './practice.controller';

@Module({
    imports: [PrismaModule, CodeExecutionModule, SubscriptionsModule],
    controllers: [PracticeController],
    providers: [PracticeService],
    exports: [PracticeService],
})
export class PracticeModule { }
