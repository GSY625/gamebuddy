import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessLogService } from '../logging/business-log.service';
import { isProductionRuntime } from '../common/runtime-env';
import {
  MailDeliveryError,
  MailService,
  MailTimeoutError,
} from './mail.service';

type VerificationMailJob = {
  type: 'verification-code';
  email: string;
  code: string;
  queuedAt: string;
};

const MAIL_QUEUE_NAME = 'mail:verification';
const MAIL_JOB_NAME = 'verification-code';
const MAIL_QUEUE_MAX_ATTEMPTS = 3;
const MAIL_QUEUE_CONCURRENCY = 4;

@Injectable()
export class MailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailQueueService.name);
  private readonly production = isProductionRuntime();
  private queue: Queue<VerificationMailJob> | null = null;
  private worker: Worker<VerificationMailJob> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly businessLog: BusinessLogService,
  ) {}

  async onModuleInit() {
    if (!this.shouldUseBullQueue()) {
      this.logger.log('mail_queue.inline_mode');
      return;
    }

    try {
      const connection = this.getBullConnection();
      this.queue = new Queue<VerificationMailJob>(MAIL_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: MAIL_QUEUE_MAX_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: 1500,
          },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      });
      this.worker = new Worker<VerificationMailJob>(
        MAIL_QUEUE_NAME,
        async (job) => this.processVerificationJob(job),
        {
          connection,
          concurrency: MAIL_QUEUE_CONCURRENCY,
        },
      );

      this.worker.on('error', (error) => {
        this.logger.error(
          'mail_queue.worker_error',
          error instanceof Error ? error.stack : undefined,
        );
      });

      await Promise.all([
        this.queue.waitUntilReady(),
        this.worker.waitUntilReady(),
      ]);
      this.logger.log('mail_queue.bullmq_ready');
    } catch (error) {
      await this.closeResources();
      if (this.production) {
        throw error instanceof Error
          ? error
          : new Error('生产环境邮件队列初始化失败');
      }

      this.logger.warn(
        `mail_queue.fallback_inline_mode: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.closeResources();
  }

  async enqueueVerificationCode(email: string, code: string) {
    if (!this.queue) {
      await this.mail.sendCode(email, code);
      this.businessLog.log('auth.verification_code.delivered', {
        email,
        attempt: 1,
        driver: 'inline',
      });
      return;
    }

    try {
      await this.queue.add(MAIL_JOB_NAME, {
        type: 'verification-code',
        email,
        code,
        queuedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (!this.production) {
        this.logger.warn(
          `mail_queue.enqueue_failed_fallback_inline: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
        await this.mail.sendCode(email, code);
        this.businessLog.log('auth.verification_code.delivered', {
          email,
          attempt: 1,
          driver: 'inline-fallback',
        });
        return;
      }

      throw error;
    }

    this.businessLog.log('auth.verification_code.enqueued', {
      email,
      queue: MAIL_QUEUE_NAME,
      driver: 'bullmq',
    });
  }

  private shouldUseBullQueue() {
    const redisUrl = process.env.REDIS_URL?.trim();
    return Boolean(redisUrl && redisUrl !== 'memory');
  }

  private getBullConnection() {
    return {
      url: process.env.REDIS_URL!.trim(),
      maxRetriesPerRequest: null,
    };
  }

  private async processVerificationJob(job: Job<VerificationMailJob>) {
    const currentAttempt = job.attemptsMade + 1;
    const maxAttempts =
      typeof job.opts.attempts === 'number' && job.opts.attempts > 0
        ? job.opts.attempts
        : 1;

    try {
      await this.mail.sendCode(job.data.email, job.data.code);
      this.businessLog.log('auth.verification_code.delivered', {
        email: job.data.email,
        attempt: currentAttempt,
        driver: 'bullmq',
      });
    } catch (error) {
      const retryable =
        error instanceof MailTimeoutError || error instanceof MailDeliveryError;

      if (retryable && currentAttempt < maxAttempts) {
        this.businessLog.warn('auth.verification_code.retry_scheduled', {
          email: job.data.email,
          attempt: currentAttempt,
          nextAttempt: currentAttempt + 1,
          driver: 'bullmq',
        });
        throw error;
      }

      await this.prisma.emailVerification.deleteMany({
        where: { email: job.data.email, code: job.data.code },
      });

      this.businessLog.error('auth.verification_code.delivery_failed', {
        email: job.data.email,
        attempt: currentAttempt,
        driver: 'bullmq',
      });
      this.logger.error(
        'mail_queue.delivery_failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async closeResources() {
    await this.worker?.close();
    await this.queue?.close();
    this.worker = null;
    this.queue = null;
  }
}
