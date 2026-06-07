import { Injectable, LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { pruneUndefined, sanitizeForLog, serializeError } from './logging.utils';

type LogLevel = 'log' | 'warn' | 'error';
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
};

@Injectable()
export class AppLoggerService implements LoggerService {
  constructor(private requestContext: RequestContextService) {}

  log(message: string, context?: string): void;
  log(event: string, payload?: Record<string, unknown>): void;
  log(
    messageOrEvent: string,
    contextOrPayload: string | Record<string, unknown> = {},
  ) {
    if (typeof contextOrPayload === 'string') {
      this.write('log', 'nest.log', {
        message: messageOrEvent,
        context: contextOrPayload,
      });
      return;
    }

    this.write('log', messageOrEvent, contextOrPayload);
  }

  warn(message: string, context?: string): void;
  warn(event: string, payload?: Record<string, unknown>): void;
  warn(
    messageOrEvent: string,
    contextOrPayload: string | Record<string, unknown> = {},
  ) {
    if (typeof contextOrPayload === 'string') {
      this.write('warn', 'nest.warn', {
        message: messageOrEvent,
        context: contextOrPayload,
      });
      return;
    }

    this.write('warn', messageOrEvent, contextOrPayload);
  }

  error(message: string, trace?: string, context?: string): void;
  error(
    event: string,
    payload?: Record<string, unknown>,
    error?: unknown,
  ): void;
  error(
    messageOrEvent: string,
    payloadOrTrace: string | Record<string, unknown> = {},
    errorOrContext?: unknown,
  ) {
    if (typeof payloadOrTrace === 'string') {
      this.write(
        'error',
        'nest.error',
        {
          message: messageOrEvent,
          trace: payloadOrTrace,
          context:
            typeof errorOrContext === 'string' ? errorOrContext : undefined,
        },
        errorOrContext instanceof Error ? errorOrContext : undefined,
      );
      return;
    }

    this.write('error', messageOrEvent, payloadOrTrace, errorOrContext);
  }

  debug(message: string, context?: string) {
    this.write('log', 'nest.debug', {
      message,
      context,
    });
  }

  verbose(message: string, context?: string) {
    this.write('log', 'nest.verbose', {
      message,
      context,
    });
  }

  private write(
    level: LogLevel,
    event: string,
    payload: Record<string, unknown>,
    error?: unknown,
  ) {
    if (!this.shouldWrite(level)) {
      return;
    }

    const context = this.requestContext.get();
    const sanitizedPayload = sanitizeForLog(payload);
    const normalizedPayload =
      sanitizedPayload &&
      typeof sanitizedPayload === 'object' &&
      !Array.isArray(sanitizedPayload)
        ? (sanitizedPayload as Record<string, unknown>)
        : { payload: sanitizedPayload };

    const entry = pruneUndefined({
      timestamp: new Date().toISOString(),
      level,
      event,
      requestId: context?.requestId,
      method: context?.method,
      path: context?.path,
      userId: context?.userId,
      handler: context?.handler,
      ...normalizedPayload,
      ...(error ? { error: serializeError(error) } : {}),
    });

    const line = JSON.stringify(entry);
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
  }

  private shouldWrite(level: LogLevel) {
    const configuredLevel = (
      process.env.LOG_LEVEL?.trim().toLowerCase() || 'error'
    ) as LogLevel;
    const activeLevel = LOG_LEVEL_WEIGHT[configuredLevel] ?? LOG_LEVEL_WEIGHT.error;
    return LOG_LEVEL_WEIGHT[level] <= activeLevel;
  }
}
