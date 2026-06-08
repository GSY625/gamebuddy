import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class ShutdownService
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  constructor(private logger: AppLoggerService) {}

  beforeApplicationShutdown(signal?: string) {
    this.logger.warn('app.shutdown.start', {
      signal: signal ?? 'unknown',
    });
  }

  onApplicationShutdown(signal?: string) {
    this.logger.warn('app.shutdown.complete', {
      signal: signal ?? 'unknown',
    });
  }
}
