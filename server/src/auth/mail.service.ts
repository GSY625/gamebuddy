import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  getSmtpPort,
  getSmtpSecure,
  isProductionRuntime,
} from '../common/runtime-env';

export class MailConfigurationError extends Error {
  constructor(message = '邮件服务未配置完成') {
    super(message);
    this.name = 'MailConfigurationError';
  }
}

export class MailDeliveryError extends Error {
  constructor(message = '邮件发送失败') {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

export class MailTimeoutError extends MailDeliveryError {
  constructor(message = '邮件发送超时') {
    super(message);
    this.name = 'MailTimeoutError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private isTimeoutError(error: unknown) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    return (
      message.includes('timed out') ||
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('econnreset') ||
      message.includes('esocket')
    );
  }

  async sendCode(email: string, code: string) {
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.SMTP_FROM?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    if (!host) {
      if (isProductionRuntime()) {
        throw new MailConfigurationError('生产环境未配置 SMTP_HOST');
      }

      this.logger.warn(`[DEV] 验证码 ${email}: ${code}`);
      return { accepted: [email], rejected: [] as string[] };
    }

    if (!from) {
      throw new MailConfigurationError('未配置 SMTP_FROM');
    }

    if (!user || !pass) {
      throw new MailConfigurationError('未配置 SMTP_USER 或 SMTP_PASS');
    }

    const transporter = nodemailer.createTransport({
      host,
      port: getSmtpPort(),
      secure: getSmtpSecure(),
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const info = await transporter.sendMail({
          from,
          to: email,
          subject: '开黑鸭 邮箱验证码',
          text: `您的验证码是：${code}，15 分钟内有效。`,
        });

        if (info.accepted.length === 0 || info.rejected.includes(email)) {
          throw new MailDeliveryError();
        }

        return info;
      } catch (error) {
        const timeout = this.isTimeoutError(error);
        this.logger.error(
          'mail.send_code_failed',
          error instanceof Error ? error.stack : undefined,
        );

        if (timeout && attempt < 2) {
          await sleep(800);
          continue;
        }

        if (timeout) {
          throw new MailTimeoutError();
        }

        throw new MailDeliveryError();
      }
    }

    throw new MailDeliveryError();
  }
}
