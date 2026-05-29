import { Logger, Provider } from '@nestjs/common';
import { AiProvider } from '@ai-board/shared';
import { APP_CONFIG } from '../config/config.module';
import { Config } from '../config/configuration';
import { MockProvider } from './providers/mock.provider';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

/** DI token for the active AI provider (resolved from config at boot). */
export const AI_PROVIDER = Symbol('AI_PROVIDER');

/**
 * Selects the concrete provider from configuration. Adding a new runtime means
 * adding a driver + a branch here — no feature code changes.
 */
export const AiProviderFactory: Provider = {
  provide: AI_PROVIDER,
  inject: [APP_CONFIG],
  useFactory: (config: Config): AiProvider => {
    const logger = new Logger('AiProviderFactory');
    const { ai } = config;
    switch (ai.provider) {
      case 'ollama':
        logger.log(`Using Ollama provider @ ${ai.baseUrl}`);
        return new OllamaProvider({
          baseUrl: ai.baseUrl,
          defaultChatModel: ai.defaultChatModel,
          defaultEmbeddingModel: ai.defaultEmbeddingModel,
          requestTimeoutMs: ai.requestTimeoutMs,
        });
      case 'openai-compatible':
        logger.log(`Using OpenAI-compatible provider @ ${ai.baseUrl}`);
        return new OpenAiCompatibleProvider({
          baseUrl: ai.baseUrl,
          apiKey: ai.apiKey,
          defaultChatModel: ai.defaultChatModel,
          defaultEmbeddingModel: ai.defaultEmbeddingModel,
          requestTimeoutMs: ai.requestTimeoutMs,
        });
      case 'mock':
        logger.warn('Using MOCK AI provider — no real model calls will be made');
        return new MockProvider(ai.embeddingDimensions);
      default:
        throw new Error(`Unsupported AI provider: ${ai.provider as string}`);
    }
  },
};
