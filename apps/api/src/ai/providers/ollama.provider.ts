import {
  AiProvider,
  AiProviderKind,
  ChatChunk,
  ChatMessage,
  ChatOptions,
  ChatResult,
  EmbeddingOptions,
  EmbeddingResult,
  ModelInfo,
} from '@ai-board/shared';
import { fetchJson, streamNdjson } from './http.util';

interface OllamaConfig {
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  requestTimeoutMs: number;
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    details?: { family?: string; parameter_size?: string };
  }>;
}

interface OllamaChatResponse {
  model: string;
  message?: { role: string; content: string };
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaEmbedResponse {
  embeddings: number[][];
}

/**
 * Driver for a local Ollama runtime (https://ollama.com). Implements the shared
 * `AiProvider` contract so the rest of the app is unaware it's talking to Ollama.
 */
export class OllamaProvider implements AiProvider {
  readonly kind = AiProviderKind.OLLAMA;

  constructor(private readonly config: OllamaConfig) {}

  async health(): Promise<boolean> {
    try {
      await fetchJson(`${this.config.baseUrl}/api/tags`, { timeoutMs: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetchJson<OllamaTagsResponse>(`${this.config.baseUrl}/api/tags`, {
      timeoutMs: 10_000,
    });
    return (res.models ?? []).map((m) => ({
      id: m.name,
      family: m.details?.family,
      parameterSize: m.details?.parameter_size,
    }));
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const res = await fetchJson<OllamaChatResponse>(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      timeoutMs: options.timeoutMs ?? this.config.requestTimeoutMs,
      signal: options.signal,
      body: {
        model: options.model ?? this.config.defaultChatModel,
        messages: messages.map(this.toOllamaMessage),
        stream: false,
        ...(options.json ? { format: 'json' } : {}),
        options: this.toOllamaOptions(options),
      },
    });
    return {
      content: res.message?.content ?? '',
      model: res.model,
      promptTokens: res.prompt_eval_count,
      completionTokens: res.eval_count,
      totalTokens:
        res.prompt_eval_count != null && res.eval_count != null
          ? res.prompt_eval_count + res.eval_count
          : undefined,
      finishReason: res.done_reason,
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const stream = streamNdjson(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      timeoutMs: options.timeoutMs ?? this.config.requestTimeoutMs,
      signal: options.signal,
      body: {
        model: options.model ?? this.config.defaultChatModel,
        messages: messages.map(this.toOllamaMessage),
        stream: true,
        ...(options.json ? { format: 'json' } : {}),
        options: this.toOllamaOptions(options),
      },
    });
    for await (const raw of stream) {
      const evt = raw as OllamaChatResponse & { done?: boolean };
      yield { delta: evt.message?.content ?? '', done: Boolean(evt.done) };
    }
  }

  async embed(input: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    const model = options.model ?? this.config.defaultEmbeddingModel;
    const res = await fetchJson<OllamaEmbedResponse>(`${this.config.baseUrl}/api/embed`, {
      method: 'POST',
      timeoutMs: options.timeoutMs ?? this.config.requestTimeoutMs,
      signal: options.signal,
      body: { model, input },
    });
    const embeddings = res.embeddings ?? [];
    return {
      embeddings,
      model,
      dimensions: embeddings[0]?.length ?? 0,
    };
  }

  private toOllamaMessage(m: ChatMessage) {
    return {
      role: m.role,
      content: m.content,
      ...(m.images && m.images.length > 0 ? { images: m.images } : {}),
    };
  }

  private toOllamaOptions(options: ChatOptions) {
    const out: Record<string, number> = {};
    if (options.temperature != null) out.temperature = options.temperature;
    if (options.topP != null) out.top_p = options.topP;
    if (options.maxTokens != null) out.num_predict = options.maxTokens;
    return out;
  }
}
