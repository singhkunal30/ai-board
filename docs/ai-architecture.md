# AI architecture

AI-Board treats the AI runtime as a swappable dependency. **No paid cloud API
is required**; the default target is a local [Ollama](https://ollama.com)
instance, and any OpenAI-compatible server (vLLM, LM Studio, llama.cpp,
LocalAI) works through the same abstraction.

## The provider abstraction

A single contract lives in `packages/shared/src/ai.ts`:

```ts
interface AiProvider {
  kind: AiProviderKind;
  health(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  chat(messages, options?): Promise<ChatResult>;
  chatStream(messages, options?): AsyncIterable<ChatChunk>;
  embed(input, options?): Promise<EmbeddingResult>;
}
```

All feature code depends on `AiService` (the app-facing facade), which delegates
to whichever `AiProvider` was selected at boot. **Feature code never imports a
vendor.**

### Drivers

| Driver | Target | Notes |
| --- | --- | --- |
| `OllamaProvider` | Ollama `/api/*` | Default. Chat, NDJSON streaming, batch `/api/embed`, multimodal `images`. |
| `OpenAiCompatibleProvider` | `/v1/*` | vLLM, LM Studio, llama.cpp server, LocalAI. SSE streaming, `response_format: json_object`. |
| `MockProvider` | none | Deterministic, dependency-free; used in tests/CI. Hash-projected normalized embeddings. |

Selection happens in `AiProviderFactory` from `AI_PROVIDER`. Adding a runtime =
one new driver + one `switch` branch. No business-logic changes.

### Switching models / runtimes

```bash
# Local Ollama (default)
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_DEFAULT_CHAT_MODEL=qwen2.5:7b-instruct
AI_DEFAULT_EMBEDDING_MODEL=nomic-embed-text

# vLLM / LM Studio / llama.cpp
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://localhost:8000
AI_API_KEY=...                 # if the endpoint requires one
```

Per-workspace overrides are stored in `ai_model_configs`; models advertised by
the runtime are surfaced via `GET /api/ai/models` to populate pickers. Supported
model families include Qwen, Llama, Gemma, DeepSeek, and Mistral.

## Resilience details

- **Timeouts**: every call has a bounded timeout (`AI_REQUEST_TIMEOUT_MS`) via a
  combined AbortController, plus support for caller-supplied `AbortSignal`.
- **Streaming**: Ollama NDJSON and OpenAI SSE are both normalized to a single
  `ChatChunk` stream and re-emitted to clients as SSE at
  `POST /api/ai/chat/stream`.
- **JSON robustness**: local models sometimes wrap JSON in prose or code
  fences. `parseJsonLoose` extracts the first balanced JSON value, so
  structured-output features (mind maps, diagrams, task extraction) are reliable
  even with smaller models.

## RAG (planned, schema in place)

The `embeddings` table (pgvector, HNSW, cosine) is the retrieval store.
Embeddings are produced through `AiService.embed`, scoped by
`workspaceId`/`boardId`, with `sourceType` distinguishing board objects,
document chunks, comments, and board summaries. Retrieval will use cosine
distance (`<=>`) with optional hybrid (keyword + vector) ranking, feeding board-
and workspace-aware context into chat and agents.

## AI features (built on this base)

The provider + RAG foundation supports the planned feature set: board
summarize/explain, mind-map and diagram generation, sticky-note clustering,
knowledge graph, task extraction, meeting mode, research mode, board chat, and
the specialized agents (Product Manager, Architect, Research, Scrum). Each is a
prompt/orchestration module over `AiService` + retrieval — see
[roadmap.md](roadmap.md) for sequencing.
