import { Injectable } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service';

@Injectable()
export class BusinessLogService {
  constructor(private logger: AppLoggerService) {}

  log(event: string, payload: Record<string, unknown> = {}) {
    this.logger.log(event, {
      category: 'business',
      ...payload,
    });
  }
}
