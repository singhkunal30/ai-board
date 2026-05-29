# Production deployment guide

This guide covers deploying AI-Board to a server (Docker Compose) or a
Kubernetes cluster. The platform is designed to run entirely on infrastructure
you control, with AI served by a local LLM runtime (Ollama / vLLM).

## Components

| Component | Purpose | Notes |
| --- | --- | --- |
| `api` | NestJS REST + realtime (Yjs) server | stateless; scale horizontally |
| `web` | Next.js client | stateless; public API/WS URLs baked at build |
| PostgreSQL + pgvector | relational data + vector store | managed Postgres recommended |
| Redis | cache / rate-limit / realtime fan-out | |
| MinIO / S3 | document & image object storage | any S3-compatible store |
| Ollama / vLLM | local LLM runtime | GPU strongly recommended |

## Configuration

All config is environment-driven and validated at boot (see `.env.example`).
Required secrets: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
(both ≥32 chars — generate with `openssl rand -base64 48`), and `S3_ACCESS_KEY`
/ `S3_SECRET_KEY` when using S3 storage.

## Option A — Docker Compose (single host)

```bash
cp .env.example .env          # set strong secrets, CORS_ORIGINS, AI_BASE_URL
docker compose up -d          # postgres, redis, minio, ollama
# Build and run the app images:
docker build -t ai-board-api -f apps/api/Dockerfile .
docker build -t ai-board-web -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://board.example.com \
  --build-arg NEXT_PUBLIC_WS_URL=wss://board.example.com/realtime .
# The api image runs `prisma migrate deploy` on start.
docker run -d --env-file .env -p 4000:4000 ai-board-api
docker run -d -p 3000:3000 ai-board-web
```

Pull AI models once: `docker exec aiboard-ollama ollama pull qwen2.5:7b-instruct`
and `... pull nomic-embed-text`.

## Option B — Kubernetes

Manifests live in `k8s/` (kustomize). They assume images published to a
registry (CI builds `ai-board-api` and `ai-board-web`).

```bash
# 1. Create real secrets (do NOT use the placeholders in config.yaml):
kubectl create namespace ai-board
kubectl -n ai-board create secret generic ai-board-secrets \
  --from-literal=DATABASE_URL="postgresql://aiboard:***@postgres:5432/aiboard?schema=public" \
  --from-literal=JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -base64 48)" \
  --from-literal=S3_ACCESS_KEY=*** --from-literal=S3_SECRET_KEY=*** \
  --from-literal=POSTGRES_PASSWORD=***

# 2. Apply everything:
kubectl apply -k k8s/

# 3. Watch rollout:
kubectl -n ai-board rollout status deploy/api
```

What the manifests provide:
- `api` Deployment (2 replicas) with an **initContainer that runs migrations**,
  liveness `/health` + readiness `/health/ready` probes, and an **HPA** (2→10
  on 70% CPU).
- `web` Deployment (2 replicas).
- `postgres` StatefulSet (pgvector) and `redis` Deployment.
- `ingress` routing `/api` and `/realtime` to the API and everything else to
  the web app, with TLS via cert-manager.

For production, prefer a **managed Postgres** with `vector` enabled and point
`DATABASE_URL` at it (drop `postgres.yaml`). Run **Ollama on a GPU node pool**
and set `AI_BASE_URL` accordingly; the same applies to vLLM
(`AI_PROVIDER=openai-compatible`).

## Database migrations

Migrations are applied automatically (api image entrypoint / k8s initContainer).
To run manually: `pnpm db:deploy` with `DATABASE_URL` set.

## Observability

- **Metrics**: every API pod exposes Prometheus metrics at `/metrics` and is
  annotated for scraping. With kube-prometheus-stack they're discovered
  automatically; otherwise see `monitoring/prometheus.yml`.
- **Logs**: structured JSON (pino) to stdout — ship with your cluster's log agent.
- **Dashboards**: import request-rate/latency from `http_request_duration_seconds`
  and `http_requests_total` into Grafana.

## Scaling notes

- The API is stateless; scale via the HPA. For multi-node realtime, enable the
  Hocuspocus Redis extension (Redis is already provisioned) so document updates
  fan out across pods.
- pgvector with the HNSW index handles RAG retrieval well at the target scale;
  move embeddings to a dedicated vector DB only if volume demands it.

## Security checklist

- [ ] Strong, rotated `JWT_*` secrets; never reuse across environments
- [ ] `CORS_ORIGINS` restricted to your web origin(s)
- [ ] TLS terminated at the ingress; `wss://` for realtime
- [ ] Object storage credentials scoped to the bucket
- [ ] Network policy restricting DB/Redis/MinIO to the namespace
- [ ] Backups for Postgres and object storage
