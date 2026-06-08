import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppLoggerService } from './logging/app-logger.service';
import {
  getUploadDir,
  shouldServeLocalUploads,
  validateServerRuntimeEnv,
} from './common/runtime-env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);
  validateServerRuntimeEnv();
  app.enableShutdownHooks();

  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', {}, reason);
  });
  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', {}, error);
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
    app.useStaticAssets(join(process.cwd(), uploadDir), { prefix: '/uploads/' });
  }
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log('app.started', { port });
}
bootstrap();
