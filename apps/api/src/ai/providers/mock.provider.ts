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

/**
 * Deterministic, dependency-free provider used in tests and CI where no LLM
 * runtime is available. Embeddings are a stable hash projection so semantic
 * search wiring can be exercised without a real model.
 */
export class MockProvider implements AiProvider {
  readonly kind = AiProviderKind.MOCK;

  constructor(private readonly dimensions = 768) {}

  async health(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<ModelInfo[]> {
    return [
      { id: 'mock-chat', family: 'mock' },
      { id: 'mock-embed', family: 'mock' },
    ];
  }

  async chat(messages: ChatMessage[], _options: ChatOptions = {}): Promise<ChatResult> {
    const last = messages.filter((m) => m.role === 'user').at(-1);
    const content = `mock-response: ${last?.content ?? ''}`.slice(0, 2000);
    return {
      content,
      model: 'mock-chat',
      promptTokens: 0,
      completionTokens: content.length,
      totalTokens: content.length,
      finishReason: 'stop',
    };
  }

  async *chatStream(messages: ChatMessage[], options: ChatOptions = {}): AsyncIterable<ChatChunk> {
    const { content } = await this.chat(messages, options);
    for (const word of content.split(' ')) {
      yield { delta: `${word} `, done: false };
    }
    yield { delta: '', done: true };
  }

  async embed(input: string[], _options: EmbeddingOptions = {}): Promise<EmbeddingResult> {
    return {
      embeddings: input.map((text) => this.hashEmbed(text)),
      model: 'mock-embed',
      dimensions: this.dimensions,
    };
  }

  private hashEmbed(text: string): number[] {
    const vec = new Array<number>(this.dimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % this.dimensions] += text.charCodeAt(i);
    }
    // L2-normalize so cosine distance behaves.
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
