import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

type Role = 'user' | 'admin' | 'superAdmin';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const role = req.user?.role;
    if (role === 'admin' || role === 'superAdmin') {
      return true;
    }
    throw new ForbiddenException('仅管理员可访问');
  }
}
