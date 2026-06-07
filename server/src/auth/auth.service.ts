import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private rateLimit: EmailCodeRateLimitService,
    private visibility: VisibilityService,
    private businessLog: BusinessLogService,
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
      message: '验证码已发送到邮箱，请查看邮件并在 15 分钟内完成验证',
      devCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  async register(dto: RegisterDto) {
    const email = this.normalizeEmailOrThrow(dto.email);
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) throw new ConflictException('邮箱已注册');

    const nickname = dto.nickname.trim();
    if (!nickname) throw new BadRequestException('昵称不能为空');

    const nickTaken = await this.prisma.user.findFirst({
      where: { nickname },
      select: { id: true },
    });
    if (nickTaken) throw new ConflictException('昵称已被占用');

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
    this.businessLog.log('auth.register.success', {
      userId: user.id,
      email,
      role,
    });
    return this.tokenResponse(user);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = this.normalizeEmailOrThrow(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new BadRequestException('邮箱未注册');

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
    this.businessLog.log('auth.password.reset', {
      userId: user.id,
      email,
    });
    return { message: '密码重置成功，请使用新密码登录' };
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmailOrThrow(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');
    if (user.isBanned) throw new UnauthorizedException('账号已被封禁');

    const nextRole = await this.resolveRoleForEmail(email, user.role);
    if (nextRole !== user.role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: nextRole },
      });
      user.role = nextRole;
    }

    this.businessLog.log('auth.login.success', {
      userId: user.id,
      email,
      role: user.role,
    });
    return this.tokenResponse(user);
  }

  private async verifyCode(email: string, code: string) {
    const record = await this.prisma.emailVerification.findFirst({
      where: { email, code },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt < new Date()) return false;

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
    const configured = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (configured.includes(email.toLowerCase())) {
      return 'superAdmin';
    }

    const adminCount = await this.prisma.user.count({
      where: { role: { in: ['admin', 'superAdmin'] } },
    });
    if (adminCount === 0) {
      return 'superAdmin';
    }

    return currentRole;
  }

  private tokenResponse(user: {
    id: string;
    email: string;
    nickname: string;
    role?: string;
  }) {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }
}
