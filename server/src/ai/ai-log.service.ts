import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AiLogEntry } from './ai.types';

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

@Injectable()
export class AiLogService {
  constructor(private prisma: PrismaService) {}

  async record(entry: AiLogEntry) {
    const id = randomUUID();
    const userId = entry.userId ?? null;
    const outputSummary = entry.outputSummary
      ? truncate(entry.outputSummary, 2000)
      : null;
    const errorMessage = entry.errorMessage
      ? truncate(entry.errorMessage, 1000)
      : null;

    try {
      await this.prisma.$executeRaw`
        INSERT INTO "ai_interaction_logs" (
          "id",
          "user_id",
          "scene",
          "model",
          "input_summary",
          "output_summary",
          "latency_ms",
          "status",
          "error_message"
        )
        VALUES (
          ${id},
          ${userId},
          ${truncate(entry.scene, 80)},
          ${truncate(entry.model, 120)},
          ${truncate(entry.inputSummary, 2000)},
          ${outputSummary},
          ${Math.max(0, Math.round(entry.latencyMs))},
          ${entry.status},
          ${errorMessage}
        )
      `;
    } catch {
      // AI logging must not break AI assistance or existing business flows.
    }
  }
}
