import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id?: string };
      route?: { path?: string };
    }>();

    this.requestContext.set({
      userId: request.user?.id,
      handler: `${context.getClass().name}.${context.getHandler().name}`,
      path: request.route?.path ?? this.requestContext.get()?.path,
    });

    return next.handle();
  }
}
