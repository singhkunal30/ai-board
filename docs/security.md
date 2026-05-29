# Security architecture

## Authentication

- **Passwords** are hashed with **argon2id** (memory-hard). Login uses constant
  effort on the failure path to blunt user-enumeration timing.
- **Access tokens**: short-lived JWTs (default 15 min) signed with
  `JWT_ACCESS_SECRET`. Stateless; carry `sub` + `email`.
- **Refresh tokens**: long-lived JWTs (default 30 days) signed with a
  *separate* `JWT_REFRESH_SECRET`. Each is bound to a `Session` row
  (`jti = session.id`). Only an **argon2 hash** of the refresh token is stored.
- **Rotation & reuse detection**: every refresh rotates the session (old one
  revoked, new pair issued). If a refresh token fails its hash check (replay of
  a rotated/stolen token), the session is revoked defensively.
- **Logout** revokes the backing session.

## Authorization (RBAC)

Two scopes combine into one permission set:

- **Workspace roles**: `OWNER > ADMIN > MEMBER > VIEWER`.
- **Board roles** (optional overrides): `EDITOR`, `COMMENTER`, `VIEWER`.

Guards check **atomic permissions** (e.g. `content:edit`, `board:delete`), not
roles, so the role→permission mapping can evolve in one place
(`packages/shared/src/rbac.ts`). `effectivePermissions(workspaceRole,
boardRole?)` is the single source of truth, shared by the HTTP guard and the
realtime gateway.

`PermissionsGuard` resolves scope from route params by convention
(`:boardId` → board scope, `:workspaceId` → workspace scope), loads the
caller's access via `AccessControlService`, and **fails closed** if a permission
is required but no scope is present.

**No information leakage**: requests for resources the caller can't see return
`404`, not `403`, so existence isn't revealed across tenants. Private boards
require an explicit board grant unless the caller is a workspace admin/owner.

## Transport & headers

- `@fastify/helmet` sets security headers.
- CORS is restricted to the configured origins with credentials enabled.
- `trustProxy` is on so client IPs are accurate behind a load balancer (used
  for rate limiting and audit).

## Input validation

Every request body is validated with `zod` (`ZodValidationPipe`) using schemas
shared with clients. Invalid input returns a structured `400` with field-level
errors. Snapshot/object counts are bounded to prevent oversized payloads.

## Rate limiting

`@nestjs/throttler` applies a global per-IP limit (default 120 req/min). Redis
is provisioned so the limiter can move to a shared store for multi-node
deployments.

## Auditing

`AuditService` writes an append-only `audit_logs` entry for privileged
mutations (register, workspace/board create/update/delete, membership changes,
board sharing). Auditing is best-effort and never breaks the primary operation;
where it matters, the audit write shares the same transaction as the change.

## Secrets & config

- Secrets come from the environment and are validated at boot (≥32-char JWT
  secrets enforced). `.env` is git-ignored; only `.env.example` is committed.
- Logs **redact** `authorization` and `cookie` headers.
- 5xx responses never leak internal error text to clients (the detail is logged
  server-side only).

## Realtime security

WebSocket connections to `/realtime` must present a valid JWT access token and
pass a board-permission check (`BOARD_VIEW`). Callers lacking `CONTENT_EDIT` are
forced read-only at the CRDT layer.

## Roadmap (enterprise)

The schema and provider boundaries are ready for: SSO/OIDC and Google/Microsoft
login (`oauth_identities` exists), field-level encryption for sensitive
document content, per-workspace data residency, and signed-URL object access via
MinIO/S3. See [roadmap.md](roadmap.md).
