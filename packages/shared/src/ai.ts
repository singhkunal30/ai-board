/**
 * Provider-agnostic AI contracts.
 *
 * Business logic depends ONLY on these interfaces. Concrete drivers (Ollama,
 * any OpenAI-compatible endpoint, a mock) implement `AiProvider`, so new
 * runtimes can be added without touching feature code.
 */

export const AiProviderKind = {
  OLLAMA: 'ollama',
  OPENAI_COMPATIBLE: 'openai-compatible',
  MOCK: 'mock',
} as const;
export type AiProviderKind = (typeof AiProviderKind)[keyof typeof AiProviderKind];

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Base64 image data URIs for multimodal models (optional). */
  images?: string[];
  name?: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /** Ask the model to return strict JSON when supported. */
  json?: boolean;
  /** Per-request timeout override (ms). */
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  finishReason?: string;
}

export interface ChatChunk {
  delta: string;
  done: boolean;
}

export interface EmbeddingOptions {
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

export interface ModelInfo {
  id: string;
  /** Best-effort capability flags reported by the runtime. */
  family?: string;
  parameterSize?: string;
  supportsVision?: boolean;
  contextLength?: number;
}

export interface AiProvider {
  readonly kind: AiProviderKind;
  /** Liveness probe against the underlying runtime. */
  health(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<ChatChunk>;
  embed(input: string[], options?: EmbeddingOptions): Promise<EmbeddingResult>;
}

/** Kinds of content indexed into the RAG vector store. Mirrors the DB enum. */
export const EmbeddingSourceType = {
  BOARD_OBJECT: 'BOARD_OBJECT',
  DOCUMENT_CHUNK: 'DOCUMENT_CHUNK',
  COMMENT: 'COMMENT',
  BOARD_SUMMARY: 'BOARD_SUMMARY',
} as const;
export type EmbeddingSourceType =
  (typeof EmbeddingSourceType)[keyof typeof EmbeddingSourceType];

/** The set of specialized agents exposed by the platform. */
export const AgentKind = {
  ASSISTANT: 'assistant',
  PRODUCT_MANAGER: 'product_manager',
  ARCHITECT: 'architect',
  RESEARCH: 'research',
  SCRUM: 'scrum',
} as const;
export type AgentKind = (typeof AgentKind)[keyof typeof AgentKind];
