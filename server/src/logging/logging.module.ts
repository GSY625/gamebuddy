import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppLoggerService } from './app-logger.service';
import { BusinessLogService } from './business-log.service';
import { HttpExceptionLoggingFilter } from './http-exception.filter';
import { RequestContextInterceptor } from './request-context.interceptor';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [
    RequestContextService,
    AppLoggerService,
    BusinessLogService,
    RequestContextMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionLoggingFilter,
    },
  ],
  exports: [
    RequestContextService,
    AppLoggerService,
    BusinessLogService,
    RequestContextMiddleware,
  ],
})
export class LoggingModule {}
