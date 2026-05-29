# ── Multi-stage build for the AI-Board web client (Next.js standalone) ───────
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY . .
# Public API/WS URLs are baked at build time; override via build args in CI.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4000/realtime
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm --filter @ai-board/shared build && pnpm --filter @ai-board/web build

# ── Runtime: copy the standalone server ──────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
