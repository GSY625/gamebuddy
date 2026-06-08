import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { CaptchaService } from './captcha.service';
import { LoginDto, RegisterDto, ResetPasswordDto, SendCodeDto } from './auth.dto';
import { HttpRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';
import {
  getRefreshTokenClearCookieOptions,
  getRefreshTokenCookieOptions,
  readCookieFromHeader,
  REFRESH_TOKEN_COOKIE_NAME,
} from './auth-cookie';
import { getClientIp } from '../logging/logging.utils';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthSessionService)
    private readonly authSessions: AuthSessionService,
    @Inject(CaptchaService) private readonly captchaService: CaptchaService,
  ) {}

  private buildRequestContext(req: Request) {
    return {
      userAgent:
        typeof req.headers['user-agent'] === 'string'
          ? req.headers['user-agent']
          : undefined,
      ipAddress: getClientIp(req),
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string, maxAgeMs: number) {
    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      getRefreshTokenCookieOptions(maxAgeMs),
    );
  }

  @Get('captcha')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'auth-captcha',
    limit: 20,
    windowSeconds: 60,
    message: '获取图形验证码过于频繁，请稍后再试',
  })
  getCaptcha() {
    return this.captchaService.create();
  }

  @Post('send-code')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'auth-send-code',
    limit: 5,
    windowSeconds: 600,
    message: '发送验证码过于频繁，请稍后再试',
  })
  sendCode(@Body() dto: SendCodeDto) {
    this.captchaService.verify(dto.captchaId, dto.captchaCode);
    return this.authService.sendVerificationCode(dto.email);
  }

  @Post('register')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'auth-register',
    limit: 6,
    windowSeconds: 600,
    message: '注册操作过于频繁，请稍后再试',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.buildRequestContext(req));
    this.setRefreshCookie(
      res,
      result.refreshToken,
      this.authSessions.getRefreshTokenMaxAgeMs(),
    );
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('login')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'auth-login',
    limit: 12,
    windowSeconds: 60,
    message: '登录尝试过于频繁，请稍后再试',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.buildRequestContext(req));
    this.setRefreshCookie(
      res,
      result.refreshToken,
      this.authSessions.getRefreshTokenMaxAgeMs(),
    );
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('reset-password')
  @UseGuards(HttpRateLimitGuard)
  @RateLimit({
    bucket: 'auth-reset-password',
    limit: 5,
    windowSeconds: 600,
    message: '重置密码操作过于频繁，请稍后再试',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readCookieFromHeader(
      req.headers.cookie,
      REFRESH_TOKEN_COOKIE_NAME,
    );
    const result = await this.authService.refresh(
      refreshToken ?? '',
      this.buildRequestContext(req),
    );
    this.setRefreshCookie(
      res,
      result.refreshToken,
      this.authSessions.getRefreshTokenMaxAgeMs(),
    );
    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readCookieFromHeader(
      req.headers.cookie,
      REFRESH_TOKEN_COOKIE_NAME,
    );
    res.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      getRefreshTokenClearCookieOptions(),
    );
    return this.authService.logout(refreshToken);
  }
}
