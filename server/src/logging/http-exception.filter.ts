import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import {
  getClientIp,
  sanitizeForLog,
  shouldSkipRequestLogging,
} from './logging.utils';
import { SentryService } from './sentry.service';

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  constructor(
    private logger: AppLoggerService,
    private requestContext: RequestContextService,
    private sentry: SentryService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      this.sentry.captureException(exception, {
        transport: host.getType(),
      });
      throw exception;
    }

    const http = host.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      params?: unknown;
      query?: unknown;
      body?: unknown;
      user?: { id?: string };
      headers?: Record<string, unknown>;
      ip?: string;
      socket?: { remoteAddress?: string | null };
    }>();
    const res = http.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    const path = req.originalUrl ?? req.url;
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      response && typeof response === 'object'
        ? { ...(response as Record<string, unknown>) }
        : {
            statusCode,
            message:
              typeof response === 'string'
                ? response
                : exception instanceof Error
                  ? exception.message
                  : 'Internal server error',
            error:
              statusCode === HttpStatus.INTERNAL_SERVER_ERROR
                ? 'Internal Server Error'
                : undefined,
          };

    this.requestContext.set({ userId: req.user?.id });

    if (!shouldSkipRequestLogging(path)) {
      this.logger.error(
        'request.failed',
        {
          statusCode,
          method: req.method,
          path,
          ip: getClientIp(req),
          userId: req.user?.id,
          params: sanitizeForLog(req.params),
          query: sanitizeForLog(req.query),
          body: sanitizeForLog(req.body),
          response: sanitizeForLog(body),
        },
        exception,
      );
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.sentry.captureException(exception, {
        statusCode,
        method: req.method,
        path,
        ip: getClientIp(req),
        userId: req.user?.id,
        params: sanitizeForLog(req.params) as Record<string, unknown>,
        query: sanitizeForLog(req.query) as Record<string, unknown>,
        body: sanitizeForLog(req.body) as Record<string, unknown>,
        response: sanitizeForLog(body) as Record<string, unknown>,
      });
    }

    res.status(statusCode).json(body);
  }
}
