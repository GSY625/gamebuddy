import { randomUUID, createHash } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type SessionContext = {
  userAgent?: string;
  ipAddress?: string;
};

type AccessTokenPayload = {
  sub: string;
  email: string;
  sid: string;
  type: 'access';
};

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: 'refresh';
};

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '15m';
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '30d';
const DEFAULT_DEV_REFRESH_TOKEN_SECRET = 'dev-refresh-secret';

function parseDurationToMs(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000;
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) {
    throw new Error(
      `不支持的过期时间格式：${value}，请使用如 15m / 12h / 30d 这类格式`,
    );
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multiplier[unit];
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  getAccessTokenExpiresIn() {
    return (
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      DEFAULT_ACCESS_TOKEN_EXPIRES_IN
    );
  }

  getRefreshTokenExpiresIn() {
    return (
      this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') ??
      DEFAULT_REFRESH_TOKEN_EXPIRES_IN
    );
  }

  getRefreshTokenMaxAgeMs() {
    return parseDurationToMs(this.getRefreshTokenExpiresIn());
  }

  private getRefreshTokenSecret() {
    return (
      this.configService.get<string>('REFRESH_TOKEN_SECRET')?.trim() ||
      this.configService.get<string>('JWT_SECRET')?.trim() ||
      DEFAULT_DEV_REFRESH_TOKEN_SECRET
    );
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(payload: AccessTokenPayload) {
    return this.jwt.sign(payload, {
      expiresIn: this.getAccessTokenExpiresIn() as never,
    });
  }

  private signRefreshToken(payload: RefreshTokenPayload) {
    return this.jwt.sign(payload, {
      secret: this.getRefreshTokenSecret(),
      expiresIn: this.getRefreshTokenExpiresIn() as never,
    });
  }

  private verifyRefreshToken(refreshToken: string) {
    return this.jwt.verify<RefreshTokenPayload>(refreshToken, {
      secret: this.getRefreshTokenSecret(),
    });
  }

  async createSession(
    user: { id: string; email: string },
    context: SessionContext = {},
  ) {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(Date.now() + this.getRefreshTokenMaxAgeMs());
    const refreshToken = this.signRefreshToken({
      sub: user.id,
      sid: sessionId,
      type: 'refresh',
    });

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        expiresAt: refreshExpiresAt,
        lastUsedAt: new Date(),
      },
    });

    const accessToken = this.signAccessToken({
      sub: user.id,
      email: user.email,
      sid: sessionId,
      type: 'access',
    });

    return {
      sessionId,
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async refreshSession(refreshToken: string, context: SessionContext = {}) {
    let payload: RefreshTokenPayload;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    if (payload.type !== 'refresh' || !payload.sid) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
            role: true,
            isBanned: true,
          },
        },
      },
    });

    if (session?.user.isBanned) {
      if (!session.revokedAt) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('账号已被封禁');
    }

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.isBanned ||
      session.refreshTokenHash !== this.hashToken(refreshToken)
    ) {
      if (session && !session.revokedAt) {
        await this.prisma.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }

    const nextRefreshToken = this.signRefreshToken({
      sub: session.user.id,
      sid: session.id,
      type: 'refresh',
    });
    const nextRefreshExpiresAt = new Date(Date.now() + this.getRefreshTokenMaxAgeMs());

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(nextRefreshToken),
        expiresAt: nextRefreshExpiresAt,
        lastUsedAt: new Date(),
        userAgent: context.userAgent ?? session.userAgent,
        ipAddress: context.ipAddress ?? session.ipAddress,
      },
    });

    const accessToken = this.signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      sid: session.id,
      type: 'access',
    });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextRefreshExpiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        nickname: session.user.nickname,
        role: session.user.role,
      },
    };
  }

  async revokeSessionByRefreshToken(refreshToken?: string | null) {
    if (!refreshToken) {
      return false;
    }

    try {
      const payload = this.verifyRefreshToken(refreshToken);
      if (!payload.sid) {
        return false;
      }

      await this.prisma.authSession.updateMany({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async assertAccessSessionValid(sessionId: string, userId: string) {
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) {
      throw new UnauthorizedException('登录状态已失效，请重新登录');
    }
  }
}
