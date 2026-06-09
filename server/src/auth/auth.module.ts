import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { JwtStrategy } from './jwt.strategy';
import { CaptchaService } from './captcha.service';
import { EmailCodeRateLimitService } from './email-code-rate-limit.service';
import { getJwtSecret } from '../common/runtime-env';
import { AuthSessionService } from './auth-session.service';
import { MailQueueService } from './mail-queue.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '15m';
        return {
          secret: getJwtSecret(),
          signOptions: {
            expiresIn: expiresIn as never,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    MailService,
    MailQueueService,
    JwtStrategy,
    CaptchaService,
    EmailCodeRateLimitService,
  ],
  exports: [JwtModule, AuthSessionService],
})
export class AuthModule {}
