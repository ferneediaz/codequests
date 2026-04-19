import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProblemsModule } from './problems/problems.module';
import { CodeExecutionModule } from './code-execution/code-execution.module';
import { BattlesModule } from './battles/battles.module';
import { ClansModule } from './clans/clans.module';
import { WebsocketsModule } from './websockets/websockets.module';

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
        ClansModule,
        WebsocketsModule,

        // TODO: Add these modules as we build them
        // MatchmakingModule,
        // RankingsModule,
    ],
})
export class AppModule { }
