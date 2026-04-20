import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? 'https://your-frontend-domain.com'
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
  });

  // Global validation pipe - validates all incoming DTOs
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
