# AI-Board

An internal, AI-first collaborative whiteboard platform — a self-hostable
alternative to Miro/FigJam where the AI runs on **local LLMs** (Ollama, vLLM,
LM Studio, llama.cpp, or any OpenAI-compatible endpoint) instead of paid cloud
APIs.

> **Status: foundation / backbone.** This repository currently contains the
> production-grade backend backbone — monorepo, database, auth + RBAC, realtime
> CRDT collaboration server, and the local-LLM AI provider abstraction — built
> as the base for the full product. See [docs/roadmap.md](docs/roadmap.md) for
> what is implemented now and what comes next. Nothing here is a stub: every
> endpoint shown below runs and is exercised by tests.

## What works today

- **Monorepo** (pnpm + Turborepo) with a shared types package and a NestJS
  (Fastify) API.
- **PostgreSQL + pgvector** schema with migrations and a seed.
- **Auth**: email/password (argon2), JWT access + rotating refresh tokens
  bound to DB sessions.
- **RBAC**: workspace roles (owner/admin/member/viewer) and per-board roles,
  resolved into atomic permissions and enforced by a global guard.
- **Workspaces & boards**: full CRUD, members, duplicate/archive, snapshot
  save, export.
- **Realtime collaboration**: Yjs CRDT server (Hocuspocus) with JWT- and
  permission-aware connections and Postgres persistence.
- **AI provider abstraction**: a single `AiProvider` contract with **Ollama**,
  **OpenAI-compatible**, and **mock** drivers; chat, streaming, and embeddings.
- **Observability**: structured logging (pino), Prometheus `/metrics`,
  health/readiness probes, and an append-only audit log.

## Architecture at a glance

```
apps/
  api/                 NestJS + Fastify backend
    src/
      auth/            JWT access/refresh, sessions, login/register
      authz/           RBAC: access-control service + permissions guard
      users/  workspaces/  boards/    domain modules
      ai/              provider abstraction (ollama | openai-compatible | mock)
      realtime/        Yjs/Hocuspocus collaboration gateway
      observability/   Prometheus metrics
      health/  audit/  config/  prisma/  common/
    prisma/            schema + migrations + seed
packages/
  shared/              cross-cutting types: RBAC, board, AI, auth contracts
```

Full detail: [docs/architecture.md](docs/architecture.md),
[docs/database.md](docs/database.md), [docs/security.md](docs/security.md),
[docs/ai-architecture.md](docs/ai-architecture.md).

## Quickstart

### Prerequisites

- Node.js ≥ 20.11, pnpm ≥ 9
- Docker (for Postgres/Redis/MinIO/Ollama), or a local Postgres 16 with the
  `pgvector` extension
- [Ollama](https://ollama.com) for real AI (optional — use `AI_PROVIDER=mock`
  to run without a model)

### Run it

```bash
cp .env.example .env                 # adjust secrets for anything non-local
pnpm install

# Start infrastructure (Postgres + pgvector, Redis, MinIO, Ollama)
docker compose up -d

# Generate client, apply schema, seed a demo user
pnpm db:generate
pnpm db:deploy
pnpm db:seed

# Pull models for Ollama (once)
docker exec aiboard-ollama ollama pull qwen2.5:7b-instruct
docker exec aiboard-ollama ollama pull nomic-embed-text

# Run the API (http://localhost:4000)
pnpm --filter @ai-board/api dev
```

Seeded login: `admin@ai-board.local` / `changeme-admin-12345`.

### Try it

```bash
# Register
curl -s -X POST http://localhost:4000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"supersecret123","name":"You"}'

# Health & metrics
curl http://localhost:4000/health/ready
curl http://localhost:4000/metrics

# AI (requires Ollama running, or set AI_PROVIDER=mock)
curl http://localhost:4000/api/ai/health
```

The realtime CRDT endpoint is a WebSocket at `ws://localhost:4000/realtime`;
clients (e.g. a `HocuspocusProvider`) pass the board id as the document name and
their JWT access token for auth.

## Commands

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm test` | Run unit tests |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:migrate` | Create/apply a dev migration |
| `pnpm db:deploy` | Apply migrations (prod) |
| `pnpm db:seed` | Seed demo data |
| `pnpm docker:up` / `docker:down` | Manage local infra |

## Configuration

All configuration is environment-driven and validated at boot (the process
refuses to start if misconfigured). See [.env.example](.env.example) for the
full, documented list. To switch AI runtimes, change `AI_PROVIDER` and
`AI_BASE_URL` — no code changes required.

## Mobile app (iOS & Android)

A native React Native (Expo) app lives in `apps/mobile` — auth, workspaces, a
real-time canvas (Yjs) and the AI command agent, talking to the same API.

- **iPhone:** `cd apps/mobile && npx expo start`, then scan the QR with **Expo
  Go** (no build or Apple account needed); EAS Build for a real `.ipa`.
- **Android:** build an APK with no local setup via the **Mobile APK** GitHub
  Actions workflow (downloads as an artifact), or `npm run android` locally.

Set the backend URL in the app's **Settings** screen. See
[docs/mobile.md](docs/mobile.md).

## License

Internal use.
