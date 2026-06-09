import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { RedisService } from '../redis/redis.service';

const CAPTCHA_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';

@Injectable()
export class CaptchaService {
  private readonly ttlSeconds = 5 * 60;

  constructor(private readonly redis: RedisService) {}

  async create() {
    const code = this.generateCode();
    const captchaId = randomBytes(16).toString('hex');
    await this.redis.set(
      this.buildKey(captchaId),
      this.normalize(code),
      'EX',
      this.ttlSeconds,
    );

    return {
      captchaId,
      image: this.renderSvg(code),
    };
  }

  async verify(captchaId: string, input: string) {
    if (!captchaId?.trim() || !input?.trim()) {
      throw new BadRequestException('请输入图形验证码');
    }

    const key = this.buildKey(captchaId);
    const record = await this.redis.get(key);
    await this.redis.del(key);

    if (!record) {
      throw new BadRequestException('图形验证码已过期，请刷新后重试');
    }

    if (record !== this.normalize(input)) {
      throw new BadRequestException('图形验证码错误');
    }

    return true;
  }

  private buildKey(captchaId: string) {
    return `auth:captcha:${captchaId}`;
  }

  private generateCode() {
    let code = '';
    for (let i = 0; i < 4; i += 1) {
      code += CAPTCHA_CHARS[randomInt(CAPTCHA_CHARS.length)];
    }
    return code;
  }

  private normalize(value: string) {
    return value.trim().toLowerCase();
  }

  private renderSvg(code: string) {
    const width = 132;
    const height = 44;
    const chars = [...code];
    const charNodes = chars
      .map((ch, index) => {
        const x = 18 + index * 28 + randomInt(-2, 3);
        const y = 28 + randomInt(-3, 4);
        const rotate = randomInt(-22, 23);
        return `<text x="${x}" y="${y}" fill="#f3eef8" font-size="24" font-family="Nunito, monospace" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${this.escapeXml(ch)}</text>`;
      })
      .join('');

    const noiseLines = Array.from({ length: 4 }, () => {
      const x1 = randomInt(0, width);
      const y1 = randomInt(0, height);
      const x2 = randomInt(0, width);
      const y2 = randomInt(0, height);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(192,132,252,0.35)" stroke-width="1.2"/>`;
    }).join('');

    const dots = Array.from({ length: 18 }, () => {
      const cx = randomInt(0, width);
      const cy = randomInt(0, height);
      return `<circle cx="${cx}" cy="${cy}" r="1.2" fill="rgba(249,168,212,0.45)"/>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" rx="10" fill="#1c1828"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="9" fill="none" stroke="rgba(192,132,252,0.35)"/>
  ${noiseLines}
  ${dots}
  ${charNodes}
</svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
