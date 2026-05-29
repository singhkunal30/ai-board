import { Inject, Injectable } from '@nestjs/common';
import {
  AiProvider,
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ChatResult,
  EmbeddingResult,
  ModelInfo,
} from '@ai-board/shared';
import { APP_CONFIG } from '../config/config.module';
import { Config } from '../config/configuration';
import { AI_PROVIDER } from './ai.provider';

/**
 * Application-facing AI facade. Feature modules (mind-map generation, RAG chat,
 * agents, …) depend on this service, never on a concrete provider. Defaults
 * from config are applied here so callers can stay terse.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  health(): Promise<boolean> {
    return this.provider.health();
  }

  listModels(): Promise<ModelInfo[]> {
    return this.provider.listModels();
  }

  chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    return this.provider.chat(messages, this.withDefaults(options));
  }

  chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<ChatChunk> {
    return this.provider.chatStream(messages, this.withDefaults(options));
  }

  embed(input: string[], model?: string): Promise<EmbeddingResult> {
    return this.provider.embed(input, {
      model: model ?? this.config.ai.defaultEmbeddingModel,
    });
  }

  /** Convenience for JSON-returning prompts; parses and validates the payload. */
  async chatJson<T = unknown>(messages: ChatMessage[], options: ChatOptions = {}): Promise<T> {
    const result = await this.chat(messages, { ...options, json: true });
    return parseJsonLoose<T>(result.content);
  }

  private withDefaults(options: ChatOptions): ChatOptions {
    return {
      model: this.config.ai.defaultChatModel,
      temperature: 0.4,
      ...options,
    };
  }
}

/**
 * Local models occasionally wrap JSON in prose or code fences even when asked
 * for strict JSON. Extract the first balanced JSON object/array defensively.
 */
export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through to extraction
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim()) as T;
  }
  const start = trimmed.search(/[[{]/);
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as T;
  }
  throw new Error('Model did not return valid JSON');
}
