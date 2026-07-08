import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiLogService } from './ai-log.service';
import type {
  AiChatCompletionOptions,
  AiChatCompletionResult,
  AiHealthStatus,
  AiModelTier,
} from './ai.types';

type DashScopeChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const REQUEST_TIMEOUT_MS = 30000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function summarizeMessages(messages: AiChatCompletionOptions['messages']) {
  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n')
    .slice(0, 2000);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class AiProviderService {
  constructor(
    private config: ConfigService,
    private logs: AiLogService,
  ) {}

  getHealth(): AiHealthStatus {
    const apiKey = Boolean(this.getEnv('DASHSCOPE_API_KEY'));
    const baseUrl = Boolean(this.getEnv('DASHSCOPE_BASE_URL'));
    const fastModel = Boolean(this.getEnv('AI_MODEL_FAST'));
    const qualityModel = Boolean(this.getEnv('AI_MODEL_QUALITY'));

    return {
      provider: 'dashscope-openai-compatible',
      ready: apiKey && baseUrl && fastModel && qualityModel,
      config: {
        apiKey,
        baseUrl,
        fastModel,
        qualityModel,
      },
    };
  }

  async chatCompletion(
    options: AiChatCompletionOptions,
  ): Promise<AiChatCompletionResult> {
    const startedAt = Date.now();
    let model = '';
    const inputSummary =
      options.inputSummary?.trim() || summarizeMessages(options.messages);

    try {
      const providerConfig = this.resolveProviderConfig(
        options.modelTier ?? 'fast',
      );
      model = providerConfig.model;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${providerConfig.baseUrl}/chat/completions`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${providerConfig.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: providerConfig.model,
              messages: options.messages,
              temperature: options.temperature ?? 0.4,
              max_tokens: options.maxTokens ?? 800,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const body = await response.text().catch(() => response.statusText);
          throw new BadGatewayException(
            `DashScope request failed: ${response.status} ${body.slice(0, 300)}`,
          );
        }

        const raw = (await response.json()) as DashScopeChatCompletionResponse;
        const content = raw.choices?.[0]?.message?.content?.trim();
        if (!content) {
          throw new BadGatewayException('DashScope returned empty content');
        }

        const latencyMs = Date.now() - startedAt;
        if (!options.deferLog) {
          await this.logs.record({
            userId: options.userId,
            scene: options.scene,
            model,
            inputSummary,
            outputSummary: content.slice(0, 2000),
            latencyMs,
            status: 'success',
          });
        }

        return {
          model,
          content,
          latencyMs,
          raw,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = toErrorMessage(error);
      if (!options.deferLog) {
        await this.logs.record({
          userId: options.userId,
          scene: options.scene,
          model: model || options.modelTier || 'unknown',
          inputSummary,
          latencyMs,
          status: 'failed',
          errorMessage: message,
        });
      }

      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException('DashScope request timed out');
      }
      throw new BadGatewayException('DashScope request failed');
    }
  }

  private getEnv(name: string) {
    return this.config.get<string>(name)?.trim();
  }

  private resolveProviderConfig(modelTier: AiModelTier): ProviderConfig {
    const apiKey = this.getEnv('DASHSCOPE_API_KEY');
    const baseUrl = this.getEnv('DASHSCOPE_BASE_URL');
    const model =
      modelTier === 'quality'
        ? this.getEnv('AI_MODEL_QUALITY')
        : this.getEnv('AI_MODEL_FAST');

    if (!apiKey || !baseUrl || !model) {
      throw new ServiceUnavailableException(
        'AI provider is not configured completely',
      );
    }

    return {
      apiKey,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
    };
  }
}
