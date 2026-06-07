import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLoggerService } from './app-logger.service';
import { RequestContextService } from './request-context.service';
import {
  createRequestId,
  getClientIp,
  shouldSkipRequestLogging,
} from './logging.utils';

type RequestWithMeta = Request & {
  requestId?: string;
  user?: { id?: string };
};

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private requestContext: RequestContextService,
    private logger: AppLoggerService,
  ) {}

  use(req: RequestWithMeta, res: Response, next: NextFunction) {
    const startedAt = Date.now();
    const headerValue = req.headers['x-request-id'];
    const requestId =
      typeof headerValue === 'string' && headerValue.trim()
        ? headerValue.trim()
        : Array.isArray(headerValue) && headerValue[0]
          ? headerValue[0]
          : createRequestId();
    const path = req.originalUrl ?? req.url;
    const ip = getClientIp(req);

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    this.requestContext.run(
      {
        requestId,
        method: req.method,
        path,
        ip,
      },
      () => {
        res.on('finish', () => {
          if (shouldSkipRequestLogging(path)) return;

          this.logger.log('request.completed', {
            requestId,
            method: req.method,
            path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            ip,
            userId: req.user?.id,
            contentLength: res.getHeader('content-length'),
          });
        });

        next();
      },
    );
  }
}
