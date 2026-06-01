# syntax=docker/dockerfile:1.7

# ---- Stage 1: dependencies ----
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Root package + lockfile
COPY package.json bun.lock ./

# Workspace package files (so bun resolves workspace deps)
COPY apps/client-form/package.json ./apps/client-form/package.json

RUN bun install --frozen-lockfile

# ---- Stage 2: build SPA ----
FROM oven/bun:1.3-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/client-form/node_modules ./apps/client-form/node_modules
COPY . .

RUN cd apps/client-form && bunx vite build

# ---- Stage 3: runtime ----
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime needs: node_modules, source TS, built SPA, migrations, drizzle config
COPY --from=deps  /app/node_modules           ./node_modules
COPY --from=build /app/apps/client-form/dist  ./apps/client-form/dist
COPY src                                       ./src
COPY apps/client-form/package.json             ./apps/client-form/package.json
COPY migrations                                ./migrations
COPY drizzle.config.ts                         ./drizzle.config.ts
COPY package.json tsconfig.json                ./

EXPOSE 3000
CMD ["bun", "run", "src/server.tsx"]
