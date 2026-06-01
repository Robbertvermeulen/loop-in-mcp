# Loop MCP

Async human-in-the-loop service for AI coding sessions. Claude (via MCP) creates a questionnaire, gets a shareable link, you share it with a non-developer, they answer in a web form, Claude pulls the structured answers back later.

Status: backend foundation (Plan 1). See `docs/superpowers/specs/2026-05-27-loop-mcp-design.md` for the design.

## Dev setup

```bash
bun install
cp .env.example .env
bun run db:generate
bun run db:migrate
bun run dev
```

Then exercise the API end-to-end via curl:

```bash
# 1. Create an account
curl -X POST localhost:3000/api/app/signup \
  -H 'content-type: application/json' \
  -c cookies.txt \
  -d '{"email":"me@example.com","password":"hunter2hunter2","displayName":"Robbert"}'

# 2. Create an API token
curl -X POST localhost:3000/api/app/tokens \
  -H 'content-type: application/json' \
  -b cookies.txt \
  -d '{"label":"laptop"}'
# Save the "plain" field from the response (starts with lp_).

# 3. Create a Loop request via MCP
curl -X POST localhost:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer lp_..." \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_request","arguments":{"title":"Test","context":"first test","questions":[{"id":"q1","type":"text_short","prompt":"name?"}]}}}'

# 4. The response contains a URL like http://localhost:3000/r/<token>.
# Plan 1 has no SPA — exercise the public API directly:
curl localhost:3000/api/r/<token>
curl -X POST localhost:3000/api/r/<token>/submit \
  -H 'content-type: application/json' \
  -d '{"q1":"hi"}'

# 5. Pull
curl -X POST localhost:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H "authorization: Bearer lp_..." \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_response","arguments":{"ref":"test"}}}'
```

## Client form SPA

The recipient-facing form lives in `apps/client-form/`. Built with Vite + Solid + Tailwind.

```bash
# Dev: SPA on :5173 (proxies API to :3000)
cd apps/client-form && bun run dev

# Build (output: apps/client-form/dist/, served by Hono at /r/*)
cd apps/client-form && bun run build

# Component tests
cd apps/client-form && bun run test

# E2E (boots a real backend via Playwright)
cd apps/client-form && bun run e2e
```

## Use Loop from Claude Code

Loop ships as a Claude Code plugin. Install once, connect, and `/loop-in` works naturally from any session.

### Install (one time, ~60 seconds)

```
/plugin marketplace add Robbertvermeulen/loop-in-mcp
/plugin install loop-in-mcp@loop-in-mcp
```

You'll be prompted for `loop_base_url` (default `https://loop-in-mcp.fly.dev` — the hosted instance) and `loop_token` (leave blank; `/loop-connect` fills it).

Then:

```
/loop-connect
```

Browser opens, sign up, approve. Token is written into your Claude Code MCP config. Restart Claude Code and try `/loop-in`.

### Self-hosted / local dev

If you're running Loop yourself (locally or on your own server), override the base URL:

```
/loop-connect --base-url=http://localhost:3002
```

See `docs/invocation/examples.md` for annotated example flows.

## Deploy your own instance

Loop's production deploy uses [Fly.io](https://fly.io) + [Turso](https://turso.tech) (managed libsql). Both have generous free tiers.

```bash
# 1. Provision the database
turso db create loop-in-mcp
TURSO_URL=$(turso db show loop-in-mcp --url)
TURSO_TOKEN=$(turso db tokens create loop-in-mcp)

# 2. Create the Fly app from the committed fly.toml
fly apps create loop-in-mcp     # pick a different name if the global one is taken
# Update fly.toml's `app` + PUBLIC_BASE_URL if you used a different name.

# 3. Wire Turso to Fly
fly secrets set \
  DATABASE_URL="$TURSO_URL" \
  DATABASE_AUTH_TOKEN="$TURSO_TOKEN" \
  --app loop-in-mcp

# 4. Deploy
fly deploy --app loop-in-mcp

# 5. Smoke
curl https://<your-app>.fly.dev/healthz
```

The `release_command` in `fly.toml` runs migrations on every deploy. The app sleeps when idle (auto_stop_machines = "stop") and cold-starts on first request.

## Tests

```bash
bun test
```

88 tests across unit (in-memory libsql) and integration (HTTP through Hono + MCP through SDK).

## Plan status

- [x] Plan 1 — Backend foundation + MCP MVP (text-only)
- [x] Plan 2 — Client form SPA (Vite + Solid)
- [ ] Plan 3 — Dashboard
- [ ] Plan 4 — File uploads (R2)
- [x] Plan 5 — Invocation files (`loop-in` skill + slash command)
- [x] Plan 6 — Plugin packaging + device-code auth
- [x] Plan 7 — Deploy to Fly.io with Turso
