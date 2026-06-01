---
description: Authenticate Claude Code to your Loop account. Opens a browser to approve the device, then writes the API token into your Claude Code MCP config.
argument-hint: [optional: --base-url=https://...]
---

# /loop-connect — link Claude Code to your Loop account

You are about to walk the developer through a device-code authentication flow with Loop.

## Configuration

Determine the base URL for the Loop backend:
- If `$ARGUMENTS` contains `--base-url=<url>`, use that.
- Otherwise default to `https://loop.app` (production).
- Local development override: if the env var `LOOP_BASE_URL` is set, use that.

Call this $BASE_URL throughout.

## Sanity check: verify tooling

Before starting, check whether the `claude` CLI is available:

```
command -v claude
```

- If found, you can use `claude mcp add-json` to write the MCP entry in Step 4.
- If not found, fall back to direct JSON manipulation with `jq` (see Step 4).

Also confirm `curl` is available (required). If `curl` is missing, tell the developer and stop.

## Step 1: Initiate the device code

Run via Bash (use the `Bash` tool):

```
curl -s -X POST $BASE_URL/api/device/code \
  -H 'content-type: application/json' \
  -d '{"label": "Claude Code"}'
```

Parse the JSON response. You should get:
- `deviceCode` — secret, used in polling
- `userCode` — short, user-facing (e.g., `ABCD-EFGH`)
- `verificationUri` — open this in browser
- `verificationUriComplete` — same URL but with code pre-filled
- `expiresIn` — seconds until expiry
- `interval` — seconds to wait between polls

If the call fails, tell the developer to check that `$BASE_URL` is reachable and report the error message.

## Step 2: Display the code and open browser

Tell the developer:

> Open this in your browser to connect:
>
>   <verificationUriComplete>
>
> If asked, enter code: <userCode>
>
> I'll wait here for you to approve. (Expires in 15 minutes.)

Use Bash to open the browser: `open <verificationUriComplete>` on macOS, `xdg-open` on Linux, `start` on Windows. Try `open` first; if it fails, just print the URL.

## Step 3: Poll until approved

Loop:

```
curl -s -X POST $BASE_URL/api/device/poll \
  -H 'content-type: application/json' \
  -d '{"deviceCode": "<deviceCode>"}'
```

every `<interval>` seconds.

Each response has `status`:
- `pending` — keep waiting, sleep `interval` seconds, retry
- `expired` — tell the developer it expired and stop. Suggest running `/loop-connect` again.
- `exchanged` with a `token` field — got it. Move to Step 4.
- `exchanged` without a token — race condition (already exchanged). Tell the developer to re-run `/loop-connect`.

Cap the loop at `expiresIn` seconds total wall-clock time. Between polls show a small "Waiting…" line so the developer knows you're alive.

## Step 4: Write the token into Claude Code config

Once you have the token:

**Preferred: use `claude mcp add-json`** (if `claude` CLI was found in the sanity check):

```
claude mcp add-json loop '{"type":"http","url":"$BASE_URL/mcp","headers":{"Authorization":"Bearer <token>"}}'
```

This is the canonical way to register an MCP server in Claude Code. It handles merging, file location, and atomicity automatically.

**Fallback: direct JSON manipulation with `jq`** (if `claude` CLI is not available):

1. Look up where Claude Code's MCP config lives. The canonical path is `~/.claude.json` — try that first, then fall back to `~/.claude/mcp.json` if it exists.
2. Read existing config (it's JSON; if missing, treat as `{ "mcpServers": {} }`).
3. Add/replace the `loop` server entry:
   ```json
   "loop": {
     "type": "http",
     "url": "$BASE_URL/mcp",
     "headers": { "Authorization": "Bearer <token>" }
   }
   ```
4. Write back atomically (write to `.tmp`, then `mv`).

```
CONFIG=~/.claude.json
[ ! -f "$CONFIG" ] && echo '{"mcpServers":{}}' > "$CONFIG"
jq --arg url "$BASE_URL/mcp" --arg token "$TOKEN" '
  .mcpServers.loop = {type: "http", url: $url, headers: {Authorization: ("Bearer " + $token)}}
' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
```

If neither `claude` CLI nor `jq` is available, fall back to telling the developer to manually add the entry, with the exact JSON to paste.

## Step 5: Confirm

Tell the developer:

> Connected. Restart Claude Code (or open a new session) and the Loop MCP will be active. Try `/loop-in` to send your first questionnaire.

## Don't

- Don't print the token to the terminal. The developer doesn't need to see it.
- Don't proceed past Step 1 if curl failed.
- Don't poll faster than `interval`.
- Don't overwrite an existing `loop` MCP entry silently — if one exists with a different URL, ask the developer if they want to replace it.

$ARGUMENTS
