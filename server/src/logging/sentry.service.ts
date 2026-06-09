import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { SeverityLevel } from '@sentry/nestjs';
import { sanitizeForLog } from './logging.utils';
import { RequestContextService } from './request-context.service';
import { isSentryEnabled } from './sentry.bootstrap';

@Injectable()
export class SentryService {
  constructor(private requestContext: RequestContextService) {}

  isEnabled() {
    return isSentryEnabled();
  }

  captureException(error: unknown, extra: Record<string, unknown> = {}) {
    if (!this.isEnabled()) {
      return;
    }

    const context = this.requestContext.get();

    Sentry.withScope((scope) => {
      if (context?.requestId) {
        scope.setTag('request_id', context.requestId);
      }
      if (context?.method) {
        scope.setTag('method', context.method);
      }
      if (context?.path) {
        scope.setTag('path', context.path);
      }
      if (context?.handler) {
        scope.setTag('handler', context.handler);
      }
      if (context?.ip) {
        scope.setTag('client_ip', context.ip);
      }
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }
      if (Object.keys(extra).length > 0) {
        scope.setContext(
          'extra',
          sanitizeForLog(extra) as Record<string, unknown>,
        );
      }

      Sentry.captureException(error);
    });
  }

  captureMessage(
    message: string,
    level: SeverityLevel = 'error',
    extra: Record<string, unknown> = {},
  ) {
    if (!this.isEnabled()) {
      return;
    }

    const context = this.requestContext.get();

    Sentry.withScope((scope) => {
      scope.setLevel(level);
      if (context?.requestId) {
        scope.setTag('request_id', context.requestId);
      }
      if (context?.userId) {
        scope.setUser({ id: context.userId });
      }
      if (Object.keys(extra).length > 0) {
        scope.setContext(
          'extra',
          sanitizeForLog(extra) as Record<string, unknown>,
        );
      }

      Sentry.captureMessage(message);
    });
  }
}
