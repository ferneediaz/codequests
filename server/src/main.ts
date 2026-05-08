import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  // CORS. Production: comma-separated CORS_ORIGIN. Dev: common Vite ports.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Trust the platform proxy (Render/Fly/etc.) so client IPs are correct
  // for rate limiting and logging. Idempotent in dev.
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();
  if (typeof instance?.set === 'function') {
    instance.set('trust proxy', 1);
  }

  // Global API prefix + validation pipe.
  // Health probe lives at /api/health — point your platform at that path.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error on unknown properties
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('CodeQuest Battles API')
    .setDescription('API for the competitive coding battle platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Supabase JWT token',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('clans', 'Clan management')
    .addTag('problems', 'Coding problems')
    .addTag('battles', 'Battle history')
    .addTag('rankings', 'Leaderboards')
    .addTag('subscriptions', 'Subscription & billing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
🚀 Server running on http://localhost:${port}
📚 Swagger docs at http://localhost:${port}/api/docs
  `);
}

bootstrap();
