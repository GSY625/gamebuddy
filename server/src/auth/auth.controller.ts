import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { LoginDto, RegisterDto, ResetPasswordDto, SendCodeDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(CaptchaService) private readonly captchaService: CaptchaService,
  ) {}

  @Get('captcha')
  getCaptcha() {
    return this.captchaService.create();
  }

  @Post('send-code')
  sendCode(@Body() dto: SendCodeDto) {
    this.captchaService.verify(dto.captchaId, dto.captchaCode);
    return this.authService.sendVerificationCode(dto.email);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
