import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import type { EnvironmentVariables } from './config/env.validation.js';

/**
 * Global app configuration shared by `main.ts` and the e2e tests, so tests run
 * against the same prefix, validation and error handling as production.
 * (Swagger, shutdown hooks and `listen` stay in `main.ts`.)
 */
export function configureApp(app: INestApplication): void {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }) });
}
