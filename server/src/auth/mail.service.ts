import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendCode(email: string, code: string) {
    const host = process.env.SMTP_HOST?.trim();
    if (!host) {
      this.logger.warn(`[DEV] 验证码 ${email}: ${code}`);
      return { accepted: [email], rejected: [] as string[] };
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: '开黑鸭 邮箱验证码',
      text: `您的验证码是：${code}，15 分钟内有效。`,
    });

    if (info.accepted.length === 0 || info.rejected.includes(email)) {
      throw new Error('invalid recipient mailbox');
    }

    return info;
  }
}
