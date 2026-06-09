import 'reflect-metadata';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { isAbsolute, join } from 'path';
import { AppLoggerService } from './logging/app-logger.service';
import { SentryService } from './logging/sentry.service';
import {
  getUploadDir,
  shouldServeLocalUploads,
  validateServerRuntimeEnv,
} from './common/runtime-env';
import { initializeSentry } from './logging/sentry.bootstrap';

async function bootstrap() {
  initializeSentry();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLoggerService);
  const sentry = app.get(SentryService);
  app.useLogger(logger);
  validateServerRuntimeEnv();
  app.enableShutdownHooks();

  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', {}, reason);
    sentry.captureException(reason, {
      source: 'process.unhandledRejection',
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', {}, error);
    sentry.captureException(error, {
      source: 'process.uncaughtException',
    });
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  if (shouldServeLocalUploads()) {
    const uploadDir = getUploadDir();
    const uploadRoot = isAbsolute(uploadDir)
      ? uploadDir
      : join(process.cwd(), uploadDir);
    app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });
  }
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log('app.started', { port });
}
bootstrap().catch((error) => {
  initializeSentry();
  Sentry.captureException(error);
  loggerFallback(error);
  void Sentry.close(2000).finally(() => {
    process.exit(1);
  });
});

function loggerFallback(error: unknown) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
}
