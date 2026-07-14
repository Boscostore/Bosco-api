import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // HTTP access log: every request that reaches the API shows up in Render
  // logs with its status and duration — first checkpoint when debugging.
  const httpLogger = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      httpLogger.log(
        `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`,
      );
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origins = (config.get<string>('FRONTEND_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
  });
  Logger.log(
    origins.length
      ? `CORS restricted to: ${origins.join(' | ')}`
      : 'CORS open (FRONTEND_ORIGINS not set)',
    'Bootstrap',
  );

  const port = parseInt(config.get<string>('PORT') ?? '3000', 10);
  await app.listen(port);
  Logger.log(`Bosco API listening on http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
