# Architecture

This document describes the AI-Board backbone: its components, the decisions
behind them, and the trade-offs considered.

## Goals

1. **Local-first AI.** No dependency on paid cloud LLM APIs. The AI runtime is
   pluggable and self-hosted.
2. **Production-grade fundamentals.** AuthN/Z, multi-tenancy, auditability,
   observability, and a real migration story from day one.
3. **Maintainability.** Clear module boundaries; business logic depends on
   abstractions, not concrete vendors.
4. **Operational simplicity.** A single API process serves REST + realtime;
   one `docker compose up` provides every dependency.

## High-level components

```
                     ┌──────────────────────────────────────────┐
   Browser / client  │                NestJS API                │
  ┌───────────────┐  │  ┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐ │
  │ REST (HTTPS)  │──┼─▶│ Auth   │ │ RBAC │ │Boards│ │  AI    │ │──▶ Ollama /
  │ WS (/realtime)│──┼─▶│Sessions│ │Guard │ │ etc. │ │facade  │ │   OpenAI-compat
  └───────────────┘  │  └────────┘ └──────┘ └──────┘ └────────┘ │
                     │       │         │        │         │      │
                     │   ┌───▼─────────▼────────▼─────────▼───┐  │
                     │   │     Prisma (PostgreSQL + pgvector)  │  │
                     │   └─────────────────────────────────────┘ │
                     │   Realtime: Hocuspocus (Yjs CRDT) ───────┐ │
                     └───────────────────────────────────────────┘
                              Redis (cache/limits)   MinIO (S3 objects)
```

## Tech choices & trade-offs

### Backend: NestJS on Fastify
NestJS gives a batteries-included module system (DI, guards, interceptors,
filters) that keeps cross-cutting concerns — auth, RBAC, metrics, error
shaping — declarative and testable. Fastify is the adapter for throughput and
first-class raw-server access (needed for the WebSocket upgrade). The
alternative (bare Fastify) would mean re-inventing DI/guards; the structure
pays off as the AI/agent surface grows.

### Database: PostgreSQL + Prisma + pgvector
One database for relational data **and** vector search keeps ops simple at the
10–500-user scale this targets — no separate vector store to run, back up, and
keep consistent. pgvector with an HNSW index gives strong recall/latency for
RAG retrieval. Prisma provides type-safe queries and a first-class migration
workflow. If vector volume ever outgrows Postgres, the `Embedding` table is
isolated behind a repository boundary and can move to Qdrant without touching
callers.

### Realtime: Yjs (CRDT) via Hocuspocus
CRDTs converge without a central transform authority, tolerate offline edits,
and make multi-cursor editing straightforward — a better fit for a freeform
canvas than Operational Transform, which needs a central server to transform
every op. Hocuspocus is a production Yjs server with auth/persistence hooks; we
mount it on the API's HTTP server (`/realtime`) so there's one process to
deploy. The board's CRDT state is persisted to Postgres (`Board.yDocState`),
debounced to avoid write amplification.

### AI: provider abstraction
The entire app depends on one interface (`AiProvider` in `@ai-board/shared`):
`chat`, `chatStream`, `embed`, `listModels`, `health`. Concrete drivers
(`OllamaProvider`, `OpenAiCompatibleProvider`, `MockProvider`) are selected by
config at boot. Feature code (mind-map generation, RAG chat, agents) never
imports a vendor — adding vLLM-specific behavior or a new runtime is a new
driver plus one `switch` branch.

### Config: validated at boot
`zod` validates the full environment on startup; the process won't start
misconfigured. A single typed `Config` object is injected app-wide.

## Request lifecycle

1. **ThrottlerGuard** — per-IP rate limiting.
2. **JwtAuthGuard** — authenticates the access token (unless `@Public`).
3. **PermissionsGuard** — resolves the caller's effective permissions for the
   `:workspaceId`/`:boardId` in the route and enforces `@RequirePermissions`.
   The resolved access context is attached to the request for handler reuse.
4. **Handler** — controllers validate bodies with `ZodValidationPipe` and
   delegate to services.
5. **MetricsInterceptor** records count/latency; **AllExceptionsFilter**
   normalizes errors and prevents 5xx detail leakage.

## Multi-tenancy model

`Workspace` is the tenant boundary. Users join workspaces via `WorkspaceMember`
(with a role). Boards belong to a workspace and may grant per-user `BoardMember`
overrides. `AccessControlService` is the single authority that turns
(workspace role, optional board role) into a permission set, and it never
reveals resources the caller can't see (returns 404, not 403).

## Scaling notes

- The API is stateless (JWT auth, DB-backed sessions) and scales horizontally
  behind a load balancer.
- Realtime: Hocuspocus supports a Redis extension for multi-node fan-out; the
  current single-process setup is correct for the target scale and the Redis
  dependency is already provisioned for when it's needed.
- Boards persist both a CRDT binary (authoritative) and a JSON snapshot (cheap
  reads for REST/RAG/export), trading a little storage for fast, index-friendly
  reads.

See [database.md](database.md), [security.md](security.md), and
[ai-architecture.md](ai-architecture.md) for component deep-dives, and
[roadmap.md](roadmap.md) for sequencing.
