# Loop — Plan 7: Deploy to Fly.io with Turso

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Loop from "works on my laptop" to a real hosted URL anyone can install against. After this plan, `https://loop-in-mcp.fly.dev` serves the Hono backend (MCP, REST API, SSR pages, SPA), backed by a Turso libsql database, with `fly deploy` updating it.

**Architecture:** Multi-stage Dockerfile produces a slim Bun runtime image. Fly.io runs one machine in Amsterdam (`ams`) by default — easy to add regions later. Turso hosts libsql; the existing Drizzle code talks to it via `DATABASE_URL` + new `DATABASE_AUTH_TOKEN`. Migrations apply automatically on every deploy via Fly's `release_command`. The plugin manifest's default `loop_base_url` updates to point at the hosted URL.

**Tech Stack:** Fly.io (hosting, free Hobby tier), Turso (managed libsql, free tier), Docker multi-stage build, oven/bun base image. No new code dependencies — just one small change to `src/db/client.ts` to accept Turso's auth token.

---

## Prerequisites

- Plans 1–6 merged into `main`.
- `flyctl` CLI installed + logged in: `brew install flyctl && fly auth login`.
- `turso` CLI installed + logged in: `brew install tursodatabase/tap/turso && turso auth login`.
- Fly account in good standing (no Hobby-tier blocker).
- Decide on Fly app name. Default in this plan: `loop-in-mcp` → produces `https://loop-in-mcp.fly.dev`. If the name is taken globally on Fly, fall back to `loop-in-mcp-<short-suffix>` and adjust the URL throughout.

## File structure (created or modified by this plan)

```
loop-in-mcp/
├── Dockerfile                                              [NEW]
├── .dockerignore                                           [NEW]
├── fly.toml                                                [NEW]
├── src/db/client.ts                                        [MODIFY: accept DATABASE_AUTH_TOKEN]
├── src/db/migrate.ts                                       [MODIFY: same]
├── plugins/loop-in-mcp/.claude-plugin/plugin.json          [MODIFY: default loop_base_url]
├── README.md                                               [MODIFY: hosted install + deploy section]
└── docs/superpowers/plans/2026-06-01-loop-plan-7-fly-hosting-turso.md   ← this file
```

No new modules, tables, or tests beyond manual smoke against the deployed URL.

---

## Task 1: Make the DB client Turso-aware

**Files:**
- Modify: `src/db/client.ts`
- Modify: `src/db/migrate.ts`

The libsql client accepts an optional `authToken`. Turso requires it; local SQLite ignores it. Backwards-compatible.

- [ ] **Step 1: Update `src/db/client.ts`**

Replace the file with:

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.DATABASE_URL ?? 'file:./loop.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });
export const db = drizzle(client, { schema });
export type DB = typeof db;
```

- [ ] **Step 2: Update `src/db/migrate.ts`**

Same pattern:

```ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL ?? 'file:./loop.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './migrations' });
console.log('Migrations applied.');
```

- [ ] **Step 3: Verify**

```
bun run test
```

Should still be 106 pass 0 fail — tests use in-memory libsql which never needs the auth token, so this change is transparent locally.

```
bun run typecheck
```

Clean.

- [ ] **Step 4: Commit**

```bash
git add src/db/client.ts src/db/migrate.ts
git commit -m "Make libsql client accept DATABASE_AUTH_TOKEN for Turso"
```

---

## Task 2: Dockerfile

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `Dockerfile`** (multi-stage; deps → build SPA → slim runtime)

```dockerfile
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

RUN cd apps/client-form && bun run build

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
```

Notes:
- `oven/bun:1.3-alpine` is small (~50 MB) and matches Bun 1.3.x.
- We copy `src/` as TypeScript and let Bun JIT it. Loop is small enough this is fine; we can switch to `bun build` to produce a JS bundle later if startup time matters.
- `apps/client-form/package.json` is included in runtime only to keep the workspace structure intact; Bun doesn't strictly need it at runtime but Drizzle/path resolution might trip without it.

- [ ] **Step 2: Create `.dockerignore`**

```
.git
.worktrees
node_modules
apps/client-form/node_modules
apps/client-form/dist
*.db
*.db-journal
.env
.env.local
docs
README.md
.DS_Store
```

We rebuild `apps/client-form/dist` inside the image (it's regenerated in Stage 2), so the host-side dist is excluded.

- [ ] **Step 3: Local build smoke**

```bash
docker build -t loop-in-mcp:local .
```

Expect a successful build with no errors. If your machine doesn't have Docker installed, skip this step and rely on Fly's remote builder in Task 6 — Fly will build the image in the cloud.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "Add multi-stage Dockerfile (deps → build SPA → slim runtime)"
```

---

## Task 3: fly.toml

**Files:**
- Create: `fly.toml`

- [ ] **Step 1: Create `fly.toml`**

```toml
# fly.toml — Loop production deployment

app = "loop-in-mcp"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"
  PUBLIC_BASE_URL = "https://loop-in-mcp.fly.dev"
  SESSION_COOKIE_NAME = "loop_session"

# Apply DB migrations on every deploy, before the new app instance accepts traffic.
[deploy]
  release_command = "bun run src/db/migrate.ts"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0  # OK to scale to zero when idle (Hobby tier friendly)

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/healthz"

[[vm]]
  size = "shared-cpu-1x"
  memory = "256mb"
```

Notes:
- `app = "loop-in-mcp"`: change if the name is taken globally. Adapt `PUBLIC_BASE_URL` and the rest of the plan if so.
- `primary_region = "ams"`: closest to NL. Pick another with `fly platform regions` if you prefer.
- `auto_stop_machines = "stop"` + `min_machines_running = 0`: machine sleeps after idle, cold-starts on first request. Good for low traffic; tradeoff is ~1s cold start. If always-on is preferred later, set `min_machines_running = 1`.
- `[[vm]] size + memory`: 256MB is plenty for Bun + Loop's small footprint. Bump to 512MB if logs show OOMs.

- [ ] **Step 2: Commit**

```bash
git add fly.toml
git commit -m "Add fly.toml: ams region, /healthz checks, release migrations"
```

---

## Task 4 (user-driven): Set up Turso database

This task requires the user to run `turso` CLI commands. Claude can document but not execute these (the CLI needs interactive auth).

- [ ] **Step 1: User creates the database**

```bash
turso db create loop-in-mcp
# (or another name; record what you chose)
```

- [ ] **Step 2: User gets connection info**

```bash
# Get the libsql URL
turso db show loop-in-mcp --url
# Example output: libsql://loop-in-mcp-<account>.turso.io

# Mint an auth token (long-lived; no expiry)
turso db tokens create loop-in-mcp
# Example output: eyJhbGciOi... (long JWT)
```

Save both values. Don't commit them.

- [ ] **Step 3: User sets Fly secrets**

(Run AFTER Task 5 has run `fly launch` so the app exists.)

```bash
fly secrets set \
  DATABASE_URL="libsql://loop-in-mcp-<account>.turso.io" \
  DATABASE_AUTH_TOKEN="eyJhbGciOi..." \
  --app loop-in-mcp
```

Verification:

```bash
fly secrets list --app loop-in-mcp
```

Should show `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.

(No commit — these are runtime-only.)

---

## Task 5 (user-driven): First Fly launch

- [ ] **Step 1: Run `fly launch`** from the repo root, accepting the existing `fly.toml`

```bash
fly launch --no-deploy --copy-config
```

`--no-deploy` ensures we get to set secrets in Task 4 step 3 before the first machine boots. `--copy-config` reuses our committed `fly.toml`.

Fly will ask:
- App name: confirm `loop-in-mcp` (or whatever you put in `fly.toml`).
- Region: confirm `ams`.
- DB: choose "none" (we use Turso, not Fly Postgres).
- Redis: "none".

If `loop-in-mcp` is taken, pick a new name. Update `fly.toml` (`app = "..."` and `PUBLIC_BASE_URL`) and commit the change. Also note the new URL for Task 7.

- [ ] **Step 2: Now set the Turso secrets** (Task 4 Step 3).

- [ ] **Step 3: First deploy**

```bash
fly deploy
```

This will:
1. Build the Docker image (remote builder).
2. Push to Fly's registry.
3. Run the `release_command` (`bun run src/db/migrate.ts`) against Turso — this creates the tables.
4. Boot a new machine; route traffic.

Watch the logs: `fly logs --app loop-in-mcp`. Look for `Loop listening on http://localhost:3000`.

- [ ] **Step 4: Smoke**

```bash
curl https://loop-in-mcp.fly.dev/healthz
# Expect: {"ok":true}
```

If `healthz` fails, run `fly logs` and `fly status` to diagnose. Common issues:
- `release_command` failed → check Turso credentials.
- Port mismatch → confirm `PORT=3000` env var matches `internal_port = 3000` in fly.toml.
- 502 from Fly → check `/healthz` is actually reachable inside the machine; visit `fly ssh console`.

---

## Task 6: Update plugin manifest with hosted URL

**Files:**
- Modify: `plugins/loop-in-mcp/.claude-plugin/plugin.json`

This task is autonomous — Claude can do it. Run AFTER Tasks 4–5 succeed and the hosted URL is confirmed.

- [ ] **Step 1: Update the `loop_base_url` default**

In `plugins/loop-in-mcp/.claude-plugin/plugin.json`, change:

```json
"loop_base_url": {
  "type": "string",
  "description": "Loop backend base URL (use http://localhost:3002 for local dev, https://loop.app for production)",
  "default": "https://loop.app"
}
```

to:

```json
"loop_base_url": {
  "type": "string",
  "description": "Loop backend base URL. Default is the hosted instance; override for self-hosted or local dev.",
  "default": "https://loop-in-mcp.fly.dev"
}
```

(Adapt the URL if you chose a different Fly app name in Task 5.)

- [ ] **Step 2: Commit**

```bash
git add plugins/loop-in-mcp/.claude-plugin/plugin.json
git commit -m "Point plugin default loop_base_url at hosted Fly URL"
```

---

## Task 7: README update — hosted install + deploy section

**Files:**
- Modify: `README.md`

Autonomous. Run after Task 6.

- [ ] **Step 1: Replace the "Use Loop from Claude Code" section's note about self-hosting**

The current README mentions `https://loop.yourdomain.com` as a placeholder. Update so the hosted URL is the default and the self-hosted/local-dev cases are documented as overrides. Use real backticks in the file.

Insert or replace so the section reads:

```markdown
## Use Loop from Claude Code

Loop ships as a Claude Code plugin. Install once, connect, and `/loop-in` works naturally from any session.

### Install (one time, ~60 seconds)

\`\`\`
/plugin marketplace add Robbertvermeulen/loop-in-mcp
/plugin install loop-in-mcp@loop-in-mcp
\`\`\`

You'll be prompted for `loop_base_url` (default `https://loop-in-mcp.fly.dev` — the hosted instance) and `loop_token` (leave blank; `/loop-connect` fills it).

Then:

\`\`\`
/loop-connect
\`\`\`

Browser opens, sign up, approve. Token is written into your Claude Code MCP config. Restart Claude Code and try `/loop-in`.

### Self-hosted / local dev

If you're running Loop yourself (locally or on your own server), override the base URL:

\`\`\`
/loop-connect --base-url=http://localhost:3002
\`\`\`

See `docs/invocation/examples.md` for annotated example flows.
```

- [ ] **Step 2: Add a new "Deploy your own instance" section** (after the existing dev-setup section, before "Tests"):

```markdown
## Deploy your own instance

Loop's production deploy uses [Fly.io](https://fly.io) + [Turso](https://turso.tech) (managed libsql). Both have generous free tiers.

\`\`\`bash
# 1. Provision the database
turso db create loop-in-mcp
TURSO_URL=$(turso db show loop-in-mcp --url)
TURSO_TOKEN=$(turso db tokens create loop-in-mcp)

# 2. Create the Fly app from the committed fly.toml (no auto-deploy yet)
fly launch --no-deploy --copy-config

# 3. Wire Turso to Fly
fly secrets set \\
  DATABASE_URL="$TURSO_URL" \\
  DATABASE_AUTH_TOKEN="$TURSO_TOKEN"

# 4. Deploy
fly deploy

# 5. Smoke
curl https://<your-app>.fly.dev/healthz
\`\`\`

If you're not Robbertvermeulen, pick a different `app` in `fly.toml` (the global name has to be unique) and also update `PUBLIC_BASE_URL` to your URL.
```

- [ ] **Step 3: Mark Plan 7 complete in the Plan status section**

Add or update `- [x] Plan 7 — Deploy to Fly.io with Turso`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Document hosted install + self-deploy via Fly + Turso"
```

---

## Task 8 (user-driven): End-to-end smoke against production

- [ ] **Step 1: From a fresh Claude Code session (or your daily one)**

```
/plugin marketplace add Robbertvermeulen/loop-in-mcp
/plugin install loop-in-mcp@loop-in-mcp
```

When prompted:
- `loop_base_url`: leave default (`https://loop-in-mcp.fly.dev`) or paste your URL.
- `loop_token`: leave blank.

- [ ] **Step 2: Connect**

```
/loop-connect
```

Browser opens to `https://loop-in-mcp.fly.dev/device?code=XXXX-XXXX`. Sign up, approve. Slash command finishes with "Connected".

Verify the token is in `~/.claude.json` under `mcpServers.loop`.

- [ ] **Step 3: Real send**

```
/loop-in test vraag
```

Claude drafts, you confirm, MCP `create_request` succeeds. You get a `https://loop-in-mcp.fly.dev/r/<token>` URL. Open it in another browser (or incognito), fill in, submit.

- [ ] **Step 4: Pull**

Back in Claude Code:

```
check de testvraag
```

The skill should `list_requests` → `get_response` → show you the answers.

---

## Plan 7 Completion Criteria

- [ ] `Dockerfile` + `.dockerignore` + `fly.toml` committed.
- [ ] `src/db/client.ts` + `src/db/migrate.ts` updated to accept `DATABASE_AUTH_TOKEN`.
- [ ] Turso DB exists; Fly app exists; secrets set.
- [ ] `fly deploy` completes; `/healthz` returns 200 on the hosted URL.
- [ ] Plugin manifest's default URL points at production.
- [ ] README has both "hosted install" and "deploy your own" sections.
- [ ] Manual end-to-end smoke passes via the hosted URL.

## Out of scope (deferred)

- **Custom domain** (e.g., `loop.app`). `fly certs add loop.app` + DNS CNAME when you want it.
- **Multi-region Turso replicas.** Single region is plenty until traffic patterns suggest otherwise.
- **Observability** (Grafana, Sentry, OpenTelemetry). Fly's built-in logs + status are enough at this stage.
- **CI/CD pipeline** (auto-deploy on push to main via GitHub Actions). Manual `fly deploy` is fine for now.
- **Backup strategy for Turso** — Turso has built-in snapshots; document a restore procedure when you have data worth protecting.
