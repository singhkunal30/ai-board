# Development roadmap

AI-Board is being built in **vertical slices** that each compile, are tested,
and run — not a big-bang. This document tracks what's done and what's next.

## Phase 0 — Backbone ✅ (this repository)

- [x] Monorepo (pnpm + Turborepo), shared types package
- [x] Config validated at boot (zod), typed app config
- [x] PostgreSQL + pgvector schema, initial migration, seed
- [x] Auth: argon2 passwords, JWT access + rotating refresh sessions
- [x] RBAC: workspace + board roles → atomic permissions, global guard
- [x] Workspaces & boards: CRUD, members, duplicate/archive/export, snapshot
- [x] Realtime: Yjs/Hocuspocus gateway with JWT + permission auth + persistence
- [x] AI provider abstraction: Ollama, OpenAI-compatible, mock; chat/stream/embed
- [x] Observability: pino logs, Prometheus metrics, health/readiness, audit log
- [x] Unit tests + verified end-to-end against real Postgres
- [x] Docker Compose for local infra; API Dockerfile; CI

## Phase 1 — Persistence & RAG depth

- [x] Object storage service (MinIO/S3 + filesystem driver)
- [x] Document ingestion pipeline (PDF/DOCX/TXT/MD) → chunk → embed
- [x] RAG retrieval service (cosine search; board + document context)
- [x] Comments API + web panel
- [ ] Signed URLs for object download; hybrid keyword/vector ranking
- [ ] Board snapshot ↔ CRDT reconciliation (derive `snapshot` from `yDocState`)

## Phase 2 — Web client

- [x] Next.js + React + Tailwind app, dark/light themes
- [x] Infinite canvas (React Flow): pan, zoom, minimap
- [x] Object types: sticky notes, text, shapes, mindmap/flowchart nodes,
      markdown (PRD); connectors between nodes
- [x] Live collaboration UI: presence avatars + remote cursors via Yjs
- [x] Auth flows, workspace/board management, templates, documents UI
- [ ] More object types (tables, code blocks, embedded images), keyboard
      shortcuts, fuller accessibility pass

## Phase 3 — AI features

- [x] Board assistant: summarize, extract tasks
- [x] Mind-map generation; diagram generation (architecture, flow)
- [x] Sticky-note clustering; knowledge graph
- [x] Board chat (RAG over board + uploaded documents)
- [x] Meeting mode (notes → decisions/actions on board); research mode
- [x] Agent system (Product Manager, Architect, Research, Scrum)
- [ ] Multimodal/vision (image understanding) when the model supports it

## Phase 4 — Enterprise & scale

- [x] Kubernetes manifests (kustomize) + HPA; API/web Dockerfiles
- [x] Prometheus metrics + scrape config; production deployment guide
- [x] E2E test suite (full HTTP flow against Postgres)
- [ ] SSO / OIDC, Google & Microsoft login (schema ready: `oauth_identities`)
- [ ] Redis-backed rate limiting and Hocuspocus multi-node fan-out
- [ ] OpenTelemetry tracing + Grafana dashboards; k6 load tests
- [ ] Backups, data residency, field-level encryption for documents

## Non-goals (for now)

- Paid cloud LLM providers (local-first by design; a cloud driver could be
  added behind the same `AiProvider` interface if ever needed).
