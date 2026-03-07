import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProblemsModule } from './problems/problems.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import { BattlesModule } from './battles/battles.module';

@Module({
    imports: [
        // Load environment variables globally
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        // Database
        PrismaModule,

        // Feature modules
        AuthModule,
        UsersModule,
        ProblemsModule,
        CodeExecutionModule,
        BattlesModule,

        // TODO: Add these modules as we build them
        // ClansModule,
        // MatchmakingModule,
        // RankingsModule,
    ],
})
export class AppModule { }
