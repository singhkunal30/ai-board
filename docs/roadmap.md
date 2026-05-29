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

- [ ] Object storage service (MinIO/S3) with signed URLs
- [ ] Document ingestion pipeline (PDF/DOCX/TXT/MD/image) → chunk → embed
- [ ] RAG retrieval service (cosine + hybrid keyword/vector ranking)
- [ ] Board snapshot ↔ CRDT reconciliation (derive `snapshot` from `yDocState`)
- [ ] Comments API + presence persistence

## Phase 2 — Web client

- [ ] Next.js + React + Tailwind app, dark/light themes
- [ ] Infinite canvas (React Flow / Konva): pan, zoom, minimap, virtual render
- [ ] Object types: sticky notes, text, shapes, arrows, images, code, markdown,
      tables, frames, flowchart/UML/mindmap nodes
- [ ] Live collaboration UI: cursors, presence, selections via Yjs
- [ ] Auth flows, workspace/board management, templates

## Phase 3 — AI features

- [ ] Board assistant (summarize/explain/risks/gaps/duplicates)
- [ ] Mind-map generation; diagram generation (architecture, flow)
- [ ] Sticky-note clustering & theming
- [ ] Task extraction; knowledge graph
- [ ] Board chat (RAG over board + workspace)
- [ ] Meeting mode (notes → decisions/actions on board)
- [ ] Agent system (Product Manager, Architect, Research, Scrum) via orchestration

## Phase 4 — Enterprise & scale

- [ ] SSO / OIDC, Google & Microsoft login (schema ready: `oauth_identities`)
- [ ] Redis-backed rate limiting and Hocuspocus multi-node fan-out
- [ ] Kubernetes manifests + Helm chart; HPA
- [ ] Tracing (OpenTelemetry) + Grafana dashboards
- [ ] E2E (Playwright) + load tests (k6); coverage gates
- [ ] Backups, data residency, field-level encryption for documents

## Non-goals (for now)

- Paid cloud LLM providers (local-first by design; a cloud driver could be
  added behind the same `AiProvider` interface if ever needed).
