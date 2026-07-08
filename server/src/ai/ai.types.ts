export type AiModelTier = 'fast' | 'quality';

export type AiInteractionStatus = 'success' | 'failed';

export type AiChatRole = 'system' | 'user' | 'assistant';

export type AiChatMessage = {
  role: AiChatRole;
  content: string;
};

export type AiChatCompletionOptions = {
  scene: string;
  userId?: string | null;
  modelTier?: AiModelTier;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  inputSummary?: string;
  deferLog?: boolean;
};

export type AiChatCompletionResult = {
  model: string;
  content: string;
  latencyMs: number;
  raw: unknown;
};

export type AiHealthStatus = {
  provider: 'dashscope-openai-compatible';
  ready: boolean;
  config: {
    apiKey: boolean;
    baseUrl: boolean;
    fastModel: boolean;
    qualityModel: boolean;
  };
};

export type AiLogEntry = {
  userId?: string | null;
  scene: string;
  model: string;
  inputSummary: string;
  outputSummary?: string | null;
  latencyMs: number;
  status: AiInteractionStatus;
  errorMessage?: string | null;
};
