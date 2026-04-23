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
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SeasonsModule } from './seasons/seasons.module';
import { FriendsModule } from './friends/friends.module';
import { ChatModule } from './chat/chat.module';
import { PracticeModule } from './practice/practice.module';
import { AuthoringModule } from './problems/authoring/authoring.module';
import { LobbyModule } from './lobby/lobby.module';

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
        MatchmakingModule,
        SubscriptionsModule,
        SeasonsModule,
        FriendsModule,
        ChatModule,
        LobbyModule,
        PracticeModule,

        // Dev-only routes gated by ENABLE_AUTHOR_TOOLS=true at runtime.
        AuthoringModule,

        // TODO: Add these modules as we build them
        // RankingsModule,
    ],
})
export class AppModule { }
