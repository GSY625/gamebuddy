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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private rateLimit: EmailCodeRateLimitService,
    private visibility: VisibilityService,
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
    return {
      message: '验证码已发送。若本地未配置邮件服务，请查看后端日志。',
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
    if (nickTaken) throw new ConflictException('昵称已存在');

    const code = dto.code.trim();
    if (!code) {
      throw new BadRequestException('请输入邮箱验证码');
    }

    const verified = await this.verifyCode(email, code);
    if (!verified) {
      throw new BadRequestException('验证码无效或已过期');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname,
        emailVerified: true,
      },
    });

    await this.visibility.set(user.id, 'online');
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
      throw new BadRequestException('验证码无效或已过期');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    return { message: '密码已重置，请使用新密码登录。' };
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

  private tokenResponse(user: { id: string; email: string; nickname: string }) {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      accessToken: token,
      user: { id: user.id, email: user.email, nickname: user.nickname },
    };
  }
}
