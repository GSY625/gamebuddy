import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, ResetPasswordDto } from './auth.dto';
import { MailService } from './mail.service';
import { EmailCodeRateLimitService } from './email-code-rate-limit.service';
import { VisibilityService } from '../visibility/visibility.service';
import {
  mapMailSendError,
  validateEmailForVerification,
} from './email-validation';
import { BusinessLogService } from '../logging/business-log.service';
import { getConfiguredAdminEmails } from '../common/runtime-env';
import { RedisService } from '../redis/redis.service';
import { AuthSessionService } from './auth-session.service';

const LOGIN_FAILURE_TRACK_SECONDS = 24 * 60 * 60;
const LOGIN_LOCK_STEPS = [
  { threshold: 5, lockSeconds: 5 * 60 },
  { threshold: 8, lockSeconds: 30 * 60 },
  { threshold: 10, lockSeconds: 12 * 60 * 60 },
] as const;

export type AuthRequestContext = {
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private rateLimit: EmailCodeRateLimitService,
    private visibility: VisibilityService,
    private businessLog: BusinessLogService,
    private redis: RedisService,
    private authSessions: AuthSessionService,
  ) {}

  async sendVerificationCode(email: string) {
    const normalizedEmail = this.normalizeEmailOrThrow(email);
    await this.rateLimit.assertCanSend(normalizedEmail);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.emailVerification.deleteMany({
      where: { email: normalizedEmail },
    });
    await this.prisma.emailVerification.create({
      data: { email: normalizedEmail, code, expiresAt },
    });

    try {
      await this.mail.sendCode(normalizedEmail, code);
    } catch (error) {
      await this.prisma.emailVerification.deleteMany({
        where: { email: normalizedEmail },
      });
      throw new BadRequestException(mapMailSendError(error));
    }

    await this.rateLimit.recordSend(normalizedEmail);
    this.businessLog.log('auth.verification_code.sent', {
      email: normalizedEmail,
    });
    return {
      message: '验证码已发送到邮箱，请查看邮件并在 15 分钟内完成验证。',
      devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  async register(dto: RegisterDto, context: AuthRequestContext = {}) {
    const email = this.normalizeEmailOrThrow(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('邮箱已注册');
    }

    const nickname = dto.nickname.trim();
    if (!nickname) {
      throw new BadRequestException('昵称不能为空');
    }

    const nickTaken = await this.prisma.user.findFirst({
      where: { nickname },
      select: { id: true },
    });
    if (nickTaken) {
      throw new ConflictException('昵称已被占用');
    }

    const code = dto.code.trim();
    if (!code) {
      throw new BadRequestException('请输入邮箱验证码');
    }

    const verified = await this.verifyCode(email, code);
    if (!verified) {
      throw new BadRequestException('邮箱验证码错误或已过期');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const role = await this.resolveRoleForEmail(email);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname,
        emailVerified: true,
        role,
      },
    });

    await this.visibility.set(user.id, 'online');
    const session = await this.authSessions.createSession(user, context);

    this.businessLog.log('auth.register.success', {
      userId: user.id,
      email,
      role,
      sessionId: session.sessionId,
    });

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = this.normalizeEmailOrThrow(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new BadRequestException('邮箱未注册');
    }

    const ok = await this.verifyCode(email, dto.code.trim());
    if (!ok) {
      throw new BadRequestException('邮箱验证码错误或已过期');
    }

    const sameAsCurrent = await bcrypt.compare(dto.password, user.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestException('新密码不能与旧密码一致');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.authSessions.revokeAllUserSessions(user.id);

    this.businessLog.log('auth.password.reset', {
      userId: user.id,
      email,
    });
    return { message: '密码重置成功，请使用新密码登录' };
  }

  async login(dto: LoginDto, context: AuthRequestContext = {}) {
    const email = this.normalizeEmailOrThrow(dto.email);
    await this.assertLoginNotLocked(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      await this.handleLoginFailure(email);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.handleLoginFailure(email, user.id);
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('账号已被封禁');
    }

    const nextRole = await this.resolveRoleForEmail(email, user.role);
    if (nextRole !== user.role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: nextRole },
      });
      user.role = nextRole;
    }

    await this.clearLoginFailureState(email);
    const session = await this.authSessions.createSession(user, context);

    this.businessLog.log('auth.login.success', {
      userId: user.id,
      email,
      role: user.role,
      sessionId: session.sessionId,
    });

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string, context: AuthRequestContext = {}) {
    const refreshed = await this.authSessions.refreshSession(refreshToken, context);
    this.businessLog.log('auth.session.refreshed', {
      userId: refreshed.user.id,
      sessionId: refreshed.sessionId,
    });
    return refreshed;
  }

  async logout(refreshToken?: string | null) {
    const revoked = await this.authSessions.revokeSessionByRefreshToken(refreshToken);
    this.businessLog.log('auth.logout', {
      revoked,
    });
    return { message: '已退出登录' };
  }

  private async verifyCode(email: string, code: string) {
    const record = await this.prisma.emailVerification.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) {
      return false;
    }

    await this.prisma.emailVerification.deleteMany({ where: { email } });
    return true;
  }

  private normalizeEmailOrThrow(email: string) {
    const validation = validateEmailForVerification(email);
    if (!validation.ok) {
      throw new BadRequestException(validation.message);
    }

    return validation.normalized;
  }

  private async resolveRoleForEmail(email: string, currentRole = 'user') {
    const configured = getConfiguredAdminEmails();

    if (configured.includes(email.toLowerCase())) {
      return 'superAdmin';
    }

    return currentRole;
  }

  private loginFailureCountKey(email: string) {
    return `auth:login:failure-count:${email}`;
  }

  private loginLockKey(email: string) {
    return `auth:login:lock:${email}`;
  }

  private async assertLoginNotLocked(email: string) {
    const retryAfterSeconds = await this.redis.ttl(this.loginLockKey(email));
    if (retryAfterSeconds <= 0) {
      return;
    }

    this.businessLog.warn('auth.login.locked_hit', {
      email,
      retryAfterSeconds,
    });
    throw new HttpException(
      {
        message: `该账号登录失败次数过多，请${this.formatRetryAfter(retryAfterSeconds)}后再试`,
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async handleLoginFailure(email: string, userId?: string) {
    const countKey = this.loginFailureCountKey(email);
    const count = await this.redis.incr(countKey);
    if (count === 1) {
      await this.redis.set(countKey, '1', 'EX', LOGIN_FAILURE_TRACK_SECONDS);
    }

    const lockStep = [...LOGIN_LOCK_STEPS]
      .reverse()
      .find((step) => count >= step.threshold);

    this.businessLog.warn('auth.login.failed', {
      userId,
      email,
      failureCount: count,
      locked: Boolean(lockStep),
    });

    if (!lockStep) {
      return;
    }

    await this.redis.set(
      this.loginLockKey(email),
      String(count),
      'EX',
      lockStep.lockSeconds,
    );
    this.businessLog.warn('auth.login.locked', {
      userId,
      email,
      failureCount: count,
      retryAfterSeconds: lockStep.lockSeconds,
    });
    throw new HttpException(
      {
        message: `该账号登录失败次数过多，请${this.formatRetryAfter(lockStep.lockSeconds)}后再试`,
        retryAfterSeconds: lockStep.lockSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async clearLoginFailureState(email: string) {
    await this.redis.del(this.loginFailureCountKey(email));
    await this.redis.del(this.loginLockKey(email));
  }

  private formatRetryAfter(seconds: number) {
    if (seconds >= 3600) {
      const hours = Math.ceil(seconds / 3600);
      return `${hours} 小时`;
    }

    if (seconds >= 60) {
      const minutes = Math.ceil(seconds / 60);
      return `${minutes} 分钟`;
    }

    return `${seconds} 秒`;
  }
}
