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

interface OpenAiConfig {
  baseUrl: string;
  apiKey: string;
  defaultChatModel: string;
  defaultEmbeddingModel: string;
  requestTimeoutMs: number;
}

interface OpenAiModelsResponse {
  data: Array<{ id: string }>;
}

interface OpenAiChatResponse {
  model: string;
  choices: Array<{ message?: { content?: string }; finish_reason?: string; delta?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

interface OpenAiEmbedResponse {
  model: string;
  data: Array<{ embedding: number[] }>;
}

/**
 * Driver for any OpenAI-compatible endpoint (vLLM, LM Studio, llama.cpp server,
 * LocalAI, …). Same `/v1/...` surface, so one driver covers them all.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  readonly kind = AiProviderKind.OPENAI_COMPATIBLE;

  constructor(private readonly config: OpenAiConfig) {}

  private get authHeaders(): Record<string, string> {
    return this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {};
  }

  async health(): Promise<boolean> {
    try {
      await fetchJson(`${this.config.baseUrl}/v1/models`, {
        headers: this.authHeaders,
        timeoutMs: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetchJson<OpenAiModelsResponse>(`${this.config.baseUrl}/v1/models`, {
      headers: this.authHeaders,
      timeoutMs: 10_000,
    });
    return (res.data ?? []).map((m) => ({ id: m.id }));
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const res = await fetchJson<OpenAiChatResponse>(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this.authHeaders,
      timeoutMs: options.timeoutMs ?? this.config.requestTimeoutMs,
      signal: options.signal,
      body: this.chatBody(messages, options, false),
    });
    const choice = res.choices?.[0];
    return {
      content: choice?.message?.content ?? '',
      model: res.model,
      promptTokens: res.usage?.prompt_tokens,
      completionTokens: res.usage?.completion_tokens,
      totalTokens: res.usage?.total_tokens,
      finishReason: choice?.finish_reason,
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<ChatChunk> {
    // OpenAI streams Server-Sent Events ("data: {json}\n\n"); we normalize the
    // SSE framing into NDJSON-friendly chunks.
    const res = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.authHeaders },
      body: JSON.stringify(this.chatBody(messages, options, true)),
      signal: options.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Upstream returned ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          yield { delta: '', done: true };
          return;
        }
        const evt = JSON.parse(payload) as OpenAiChatResponse;
        yield { delta: evt.choices?.[0]?.delta?.content ?? '', done: false };
      }
    }
  }

  async embed(input: string[], options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    const model = options.model ?? this.config.defaultEmbeddingModel;
    const res = await fetchJson<OpenAiEmbedResponse>(`${this.config.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: this.authHeaders,
      timeoutMs: options.timeoutMs ?? this.config.requestTimeoutMs,
      signal: options.signal,
      body: { model, input },
    });
    const embeddings = (res.data ?? []).map((d) => d.embedding);
    return { embeddings, model, dimensions: embeddings[0]?.length ?? 0 };
  }

  private chatBody(messages: ChatMessage[], options: ChatOptions, stream: boolean) {
    return {
      model: options.model ?? this.config.defaultChatModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    };
  }
}
