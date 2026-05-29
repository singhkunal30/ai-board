# Database design

PostgreSQL 16 with the `pgvector` and `pgcrypto` extensions. Schema and
migrations are managed by Prisma (`apps/api/prisma`).

## Conventions

- **UUID primary keys** (`gen_random_uuid()` via pgcrypto). Globally unique,
  safe to expose in URLs, and not enumerable like sequential ids.
- **Soft deletes** (`deletedAt`) on user-facing aggregates (`Workspace`,
  `Board`, `Document`) so deletes are recoverable and audit history stays
  intact. Read paths filter `deletedAt: null`.
- **`@@map`/`@map`** to snake_case table/column names for SQL ergonomics.
- **Cascade rules** chosen per relationship: membership/children cascade on
  parent delete; audit logs `SetNull` their actor/workspace so history survives.

## Entities

| Table | Purpose |
| --- | --- |
| `users` | Accounts. `passwordHash` nullable to allow SSO-only users. |
| `sessions` | Refresh-token-backed sessions; `jti = session.id`. Stores an argon2 hash of the refresh token, never the token. |
| `oauth_identities` | Federated identities (google/microsoft/oidc) → user. |
| `workspaces` | Tenant boundary. Owner + settings. |
| `workspace_members` | User↔workspace with a `WorkspaceRole`. Unique per pair. |
| `boards` | Canvas. Holds CRDT `yDocState` (authoritative) + JSON `snapshot` (reads) + monotonic `version`. |
| `board_members` | Optional per-board `BoardRole` overrides. |
| `comments` | Board comments, optionally anchored to an object id. |
| `documents` | Uploaded files (PDF/DOCX/…); status tracks ingestion. |
| `embeddings` | RAG vector store; one row per chunk; `vector(768)`. |
| `ai_model_configs` | Per-workspace model/temperature selection. |
| `ai_conversations` / `ai_messages` | Board/agent chat history. |
| `audit_logs` | Append-only record of privileged mutations. |

## Indexing strategy

- Foreign-key and tenant-scoped lookups are indexed (`workspaceId`, `userId`,
  `boardId`, `(workspaceId, isArchived)`).
- Uniqueness enforced where it matters: `users.email`, `workspaces.slug`,
  `(workspaceId, userId)`, `(boardId, userId)`, `(provider, providerUserId)`.
- `audit_logs` indexes `action` and `createdAt` for investigation queries.
- **Vector search**: an HNSW index on `embeddings.embedding` with
  `vector_cosine_ops` for fast approximate nearest-neighbour retrieval on the
  read-heavy RAG path.

## Vectors & RAG

Embedding dimensionality is fixed at **768** in the schema to match the default
`nomic-embed-text` model. Changing the embedding model to a different dimension
requires a migration altering the `vector(N)` column (and reindexing). The
table carries `sourceType` + `sourceId` so a single chunked source (document,
board object, comment, board summary) maps to many vectors, scoped by
`workspaceId`/`boardId` for tenant-isolated retrieval. Similarity queries use
raw SQL (`<=>` cosine distance) since pgvector operators are outside Prisma's
typed query surface.

## Migrations

The initial migration (`prisma/migrations/0_init`) creates the extensions,
enums, tables, indexes, and the HNSW vector index. Apply with:

```bash
pnpm db:deploy     # prisma migrate deploy (idempotent, prod-safe)
```

Create new migrations during development with `pnpm db:migrate`.
