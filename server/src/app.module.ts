import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
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
import { ProblemSubmissionsModule } from './problem-submissions/problem-submissions.module';
import { AchievementsModule } from './achievements/achievements.module';
import { RankingsModule } from './rankings/rankings.module';
import { HealthModule } from './health/health.module';
import { ShareModule } from './share/share.module';
import { validateEnv } from './config/env.validation';

@Module({
    imports: [
        // Load environment variables globally; validate against the zod
        // schema so a misconfigured boot fails fast with a useful message.
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
            validate: validateEnv,
        }),

        // Per-IP rate limiting. Two tiers: short burst guard + sustained ceiling.
        // Stripe webhook + /health are decorated with @SkipThrottle().
        ThrottlerModule.forRoot([
            { name: 'short', ttl: 10_000, limit: 30 },
            { name: 'long', ttl: 60_000, limit: 120 },
        ]),

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

        // Community problem contributions + admin review (always available).
        ProblemSubmissionsModule,

        // Achievements (catalog + per-user unlocks). Definitions seed on boot.
        AchievementsModule,

        // Time-windowed leaderboards (global / clans / friends).
        RankingsModule,

        // Liveness / DB-readiness probe for hosting platforms (GET /api/health).
        HealthModule,

        // Public OG share images / metadata for completed battles.
        ShareModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Request log line per HTTP request. Excludes /api/health since
        // platform health probes hit it on a tight interval.
        consumer
            .apply(RequestLoggerMiddleware)
            .exclude('api/health')
            .forRoutes('*');
    }
}
