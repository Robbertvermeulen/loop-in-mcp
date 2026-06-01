# Loop-In MCP Plugin Format & Architecture

## TL;DR

Create a marketplace repo at `Robbertvermeulen/loop-in-mcp` with:
- `.claude-plugin/marketplace.json` listing your plugin
- `plugins/loop-in-mcp/` containing the plugin with `.claude-plugin/plugin.json`, `skills/`, and `slash-commands/` directories
- `.mcp.json` (or inline `mcpServers` in `plugin.json`) declaring the HTTP MCP server
- Users install via `/plugin marketplace add Robbertvermeulen/loop-in-mcp` then `/plugin install loop-in-mcp@loop-in-mcp`
- For per-user auth tokens, use a `/loop-connect` slash command that writes to `~/.claude.json` using `claude mcp add` CLI or `claude mcp add-json` to inject `Authorization: Bearer` headers

---

## File Layout

### Repo Root Structure

```
Robbertvermeulen/loop-in-mcp/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace catalog
├── plugins/
│   └── loop-in-mcp/             # Your plugin directory
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin manifest
│       ├── skills/
│       │   └── loop-in/
│       │       └── SKILL.md      # Main skill
│       ├── commands/             # Or use slash-commands/ for clarity
│       │   ├── loop-in.md        # /loop-in command
│       │   └── loop-connect.md   # /loop-connect command
│       ├── .mcp.json             # MCP server config (alternative: inline in plugin.json)
│       ├── README.md
│       └── LICENSE
└── README.md                      # Marketplace-level README

```

**Key points:**
- **Only `plugin.json` goes inside `.claude-plugin/`.** Skills, commands, hooks, and MCP configs live at the plugin root.
- **Relative paths in marketplace.json** resolve from the marketplace root (the directory containing `.claude-plugin/marketplace.json`), so `"source": "./plugins/loop-in-mcp"` correctly points to the plugin directory.
- Plugins are copied to `~/.claude/plugins/cache/` on install, so paths cannot reference files outside the plugin directory.

---

## Manifest Schemas

### marketplace.json

Location: `.claude-plugin/marketplace.json`

**Minimal schema:**

```json
{
  "name": "loop-in-mcp",
  "owner": {
    "name": "Robbert Vermeulen",
    "email": "robbertvermeulen@gmail.com"
  },
  "plugins": [
    {
      "name": "loop-in-mcp",
      "source": "./plugins/loop-in-mcp",
      "description": "Loop in external stakeholders via HTTP MCP, with slash commands for connection setup"
    }
  ]
}
```

**Field reference:**

| Field       | Type   | Required | Notes                                                                                                       |
|-------------|--------|----------|-------------------------------------------------------------------------------------------------------------|
| `name`      | string | Yes      | Kebab-case marketplace identifier. Must not contain spaces or uppercase. Users see this in `/plugin install` |
| `owner`     | object | Yes      | Object with required `name` (string) and optional `email` (string)                                          |
| `plugins`   | array  | Yes      | Array of plugin entries                                                                                     |
| `$schema`   | string | No       | JSON Schema URL for editor validation (ignored at load time)                                                |
| `version`   | string | No       | Marketplace manifest version                                                                                |

**Plugin entry fields:**

| Field         | Type             | Required | Notes                                                                                 |
|---------------|------------------|----------|--------------------------------------------------------------------------------------|
| `name`        | string           | Yes      | Kebab-case plugin identifier                                                         |
| `source`      | string or object | Yes      | Relative path (e.g. `"./plugins/loop-in-mcp"`) or source object; see below             |
| `description` | string           | No       | Brief description shown in marketplace                                                |
| `version`     | string           | No       | Explicit version pins the plugin; omit to use git commit SHA                          |

**Source format (relative path):**
```json
{
  "source": "./plugins/loop-in-mcp"
}
```

Resolves relative to the marketplace root. Must start with `./`.

---

### plugin.json

Location: `plugins/loop-in-mcp/.claude-plugin/plugin.json`

**Minimal schema:**

```json
{
  "name": "loop-in-mcp",
  "description": "Loop in external stakeholders with HTTP MCP and connection management",
  "version": "1.0.0",
  "author": {
    "name": "Robbert Vermeulen"
  }
}
```

**Extended schema (with MCP servers inline):**

```json
{
  "name": "loop-in-mcp",
  "displayName": "Loop In MCP",
  "description": "Loop in external stakeholders via HTTP MCP with slash commands for setup",
  "version": "1.0.0",
  "author": {
    "name": "Robbert Vermeulen",
    "email": "robbertvermeulen@gmail.com"
  },
  "homepage": "https://github.com/Robbertvermeulen/loop-in-mcp",
  "repository": "https://github.com/Robbertvermeulen/loop-in-mcp",
  "license": "MIT",
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "${user_config.loop_server_url}",
      "headers": {
        "Authorization": "Bearer ${user_config.loop_token}"
      }
    }
  },
  "userConfig": {
    "loop_server_url": {
      "type": "string",
      "title": "Loop Server URL",
      "description": "Base URL of your Loop MCP server (e.g., https://api.loop.local/mcp)",
      "required": true
    },
    "loop_token": {
      "type": "string",
      "title": "Loop API Token",
      "description": "Bearer token for Loop API authentication",
      "sensitive": true,
      "required": false
    }
  }
}
```

**Field reference:**

| Field            | Type             | Notes                                                                                   |
|------------------|------------------|-----------------------------------------------------------------------------------------|
| `name`           | string           | Required. Kebab-case identifier used for skill namespacing: `/loop-in-mcp:skill-name` |
| `description`    | string           | Shown in plugin manager                                                                 |
| `version`        | string           | Semantic version. If set, users only receive updates when bumped. Omit to use git SHA  |
| `author`         | object           | `name` required; `email` optional                                                      |
| `homepage`       | string           | Documentation URL                                                                       |
| `repository`     | string           | Source repo URL                                                                         |
| `license`        | string           | SPDX identifier (e.g., `"MIT"`)                                                        |
| `mcpServers`     | object           | Inline MCP server definitions (alternative: external `.mcp.json`)                      |
| `userConfig`     | object           | User-configurable fields (see below)                                                    |

**User configuration schema:**

```json
{
  "userConfig": {
    "key_name": {
      "type": "string|number|boolean|directory|file",
      "title": "Display Name",
      "description": "Help text",
      "sensitive": false,
      "required": true,
      "default": "optional default value"
    }
  }
}
```

- `sensitive: true` stores the value in the system keychain, not `settings.json`
- `sensitive: false` (default) stores in `settings.json` under `pluginConfigs[plugin-id].options`
- Values are available as `${user_config.key_name}` in MCP server configs, hooks, and monitor commands
- Exported to plugin subprocesses as `CLAUDE_PLUGIN_OPTION_KEY_NAME` environment variables

---

## MCP Servers in Plugins

### Declaration Method 1: Inline in plugin.json

```json
{
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "https://api.loop.local/mcp",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

### Declaration Method 2: External .mcp.json

Create `plugins/loop-in-mcp/.mcp.json`:

```json
{
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "https://api.loop.local/mcp",
      "headers": {
        "Authorization": "Bearer your-token-here"
      }
    }
  }
}
```

Then reference it in `plugin.json`:

```json
{
  "mcpServers": "./.mcp.json"
}
```

### HTTP MCP Server Schema

```json
{
  "mcpServers": {
    "server-name": {
      "type": "http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${LOOP_TOKEN}",
        "Custom-Header": "value"
      },
      "timeout": 30000
    }
  }
}
```

**Field reference:**

| Field     | Type   | Notes                                                                                  |
|-----------|--------|----------------------------------------------------------------------------------------|
| `type`    | string | `"http"` for HTTP servers (also accepts `"streamable-http"` per MCP spec)            |
| `url`     | string | Base URL of the MCP server                                                             |
| `headers` | object | Optional. Static headers sent with every request                                       |
| `timeout` | number | Optional. Request timeout in milliseconds                                              |

### Environment Variable Expansion

Claude Code supports `${VAR}` and `${VAR:-default}` syntax in `.mcp.json` and `plugin.json`:

```json
{
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "${LOOP_SERVER_URL:-https://api.loop.local/mcp}",
      "headers": {
        "Authorization": "Bearer ${LOOP_TOKEN}"
      }
    }
  }
}
```

- `${LOOP_TOKEN}` expands from the environment variable `LOOP_TOKEN`
- `${LOOP_SERVER_URL:-default}` uses the default if `LOOP_SERVER_URL` is not set
- If a required variable is missing and has no default, Claude Code fails to parse the config

### User Config Substitution

Claude Code also supports `${user_config.key_name}` in `mcpServers` configs:

```json
{
  "userConfig": {
    "loop_server_url": {
      "type": "string",
      "title": "Loop Server URL",
      "required": true
    },
    "loop_token": {
      "type": "string",
      "title": "Loop API Token",
      "sensitive": true
    }
  },
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "${user_config.loop_server_url}",
      "headers": {
        "Authorization": "Bearer ${user_config.loop_token}"
      }
    }
  }
}
```

When users enable the plugin, Claude Code prompts them for these values and injects them at runtime.

### Bearer Token Authentication: Recommended Pattern

**For plugin-bundled MCP servers requiring per-user auth:**

1. **Use `userConfig` in `plugin.json`** to prompt for the token at plugin enable time
2. **Declare the MCP server inline** or in `.mcp.json` with `${user_config.loop_token}`
3. **Add a slash command** (`/loop-connect`) that users can run to reconnect or refresh the token

**Example workflow:**

1. User: `/plugin install loop-in-mcp@loop-in-mcp`
2. Claude Code prompts: "Enter your Loop API token"
3. Token stored securely in keychain (if `sensitive: true`)
4. MCP server uses token at connection time via `${user_config.loop_token}`
5. If token expires, user runs `/loop-connect` to re-enter it

**Not recommended:**
- Do NOT hardcode tokens in manifests
- Do NOT use environment variables that users must set manually (`LOOP_TOKEN`) for per-user secrets — use `userConfig` instead
- Do NOT ask users to manually edit `~/.claude.json`

---

## Install UX & CLI Commands

### User Installation Flow

```bash
# Step 1: Add the marketplace
/plugin marketplace add Robbertvermeulen/loop-in-mcp

# Step 2: Install the plugin
/plugin install loop-in-mcp@loop-in-mcp
```

**Alternative CLI syntax (non-interactive):**

```bash
claude plugin marketplace add Robbertvermeulen/loop-in-mcp
claude plugin install loop-in-mcp@loop-in-mcp
```

### Marketplace Add Command

**Syntax:**
```bash
/plugin marketplace add <source> [options]
```

or from CLI:
```bash
claude plugin marketplace add <source> [options]
```

**Arguments:**
- `<source>`: GitHub `owner/repo` shorthand (e.g., `Robbertvermeulen/loop-in-mcp`), git URL, remote URL to a `marketplace.json` file, or local path

**Options:**
- `--scope <scope>`: `user` (default, personal plugins), `project` (team plugins in `.claude/settings.json`), or `local` (gitignored)

### Plugin Install Command

**Syntax:**
```bash
/plugin install <plugin>@<marketplace> [options]
```

or from CLI:
```bash
claude plugin install loop-in-mcp@loop-in-mcp --scope user
```

**Arguments:**
- `<plugin>@<marketplace>`: Plugin name and marketplace name

**Options:**
- `--scope <scope>`: `user`, `project`, or `local`

### Plugin Marketplace Caching

When users add a marketplace via GitHub shorthand or git URL:
- Claude Code **clones the repository** (not just fetches `marketplace.json`)
- The clone is cached in `~/.claude/plugins/marketplaces/<name>/`
- Users can update with `/plugin marketplace update <name>` (runs `git pull`)
- Marketplace pins to a specific branch/tag via `@ref` in the source, e.g., `/plugin marketplace add Robbertvermeulen/loop-in-mcp@v1.0`

### Version Resolution

When users run `/plugin install`, Claude Code resolves the plugin version from (in order):
1. `version` field in the plugin's `plugin.json`
2. `version` field in the plugin's marketplace entry
3. Git commit SHA (for git-hosted plugins)

**Recommendation:** For active development, omit `version` so every commit is treated as a new version. For stable releases, set `version: "1.0.0"` in `plugin.json` and increment it on each release.

---

## MCP Config Location & CLI

### User MCP Configuration Files

Claude Code stores MCP server configurations at three scopes:

| Scope     | Location                 | Shared?     | Loads in       |
|-----------|--------------------------|-------------|----------------|
| `user`    | `~/.claude.json`         | No          | All projects   |
| `project` | `.mcp.json` (repo root)  | Yes (git)   | This project   |
| `local`   | `~/.claude.json` (project entry) | No  | This project   |

**Note:** `~/.claude.json` stores both user-scoped and local-scoped configs in a nested structure by project path.

### Adding MCP Servers via CLI

**From a slash command or script:**

```bash
# Add an HTTP server to user scope
claude mcp add --transport http loop https://api.loop.local/mcp \
  --header "Authorization: Bearer $LOOP_TOKEN"

# Add with user scope (default)
claude mcp add --scope user --transport http loop https://api.loop.local/mcp

# Add with project scope (shared via .mcp.json)
claude mcp add --scope project --transport http loop https://api.loop.local/mcp
```

**For more control, use `claude mcp add-json`:**

```bash
# Add HTTP server with JSON config
claude mcp add-json loop \
  '{"type":"http","url":"https://api.loop.local/mcp","headers":{"Authorization":"Bearer YOUR_TOKEN"}}'
```

**What gets written:**

- `--scope user` (default): writes to `~/.claude.json` under `projects["/path/to/project"].mcpServers`
- `--scope project`: writes to `.mcp.json` in the project root
- `--scope local`: same as `--scope user` but in a local project entry

### Recommended Pattern: Slash Command for `/loop-connect`

Instead of asking users to manually run `claude mcp add`, create a `/loop-connect` slash command that:

1. Prompts the user for their Loop server URL and token
2. Calls `claude mcp add-json` or writes directly to `~/.claude.json`
3. Validates the connection by testing the MCP server
4. Prints success/failure feedback

**Example slash command stub:**

```markdown
---
description: Connect to your Loop MCP server and authenticate
---

# Connect to Loop

Prompt the user for:
1. Loop server base URL (e.g., https://api.loop.local/mcp)
2. Bearer token

Then:
1. Run `claude mcp add-json loop '<json>'` with the provided credentials
2. Test the connection by calling the Loop MCP server
3. Report success or failure

Store the credentials securely using `claude mcp add-json` so they go into the keychain (Claude Code handles this automatically for sensitive values).
```

**Implementation note:** Since slash commands run as prompts to Claude, you'll need the Bash tool enabled to call `claude mcp add-json`. Alternatively, your skill can construct the JSON and instruct the user to run the command.

---

## Skills & Slash Commands in Plugins

### Skill (Model-Invoked)

Location: `plugins/loop-in-mcp/skills/loop-in/SKILL.md`

```markdown
---
description: Loop in external stakeholders via the Loop MCP service
---

# Loop In Skill

Use this skill when the user asks to involve external stakeholders, gather feedback, or send a structured request to someone outside the current session.

The skill provides access to the Loop MCP server's tools, which handle:
- Sending questionnaires or feedback requests
- Creating invite links for stakeholders
- Tracking responses and managing workflows

Ask Claude to use the available MCP tools to loop in external parties as requested.
```

**Behavior:**
- Claude automatically invokes based on task context
- Namespaced as `/loop-in-mcp:loop-in` (or uses `name` from frontmatter)
- Can include supporting files (scripts, references) alongside `SKILL.md`

### Slash Command (User-Invoked)

Location: `plugins/loop-in-mcp/commands/loop-in.md`

```markdown
---
description: Manually invoke Loop to send a questionnaire to external stakeholders
---

# Loop In Command

Display the Loop MCP tools and ask Claude to help the user compose and send a request to external stakeholders.

The user can provide:
- The name(s) of people to loop in
- The type of feedback needed (code review, stakeholder input, design feedback)
- Any specific questions or context

Claude will use the Loop MCP tools to create and send the request.
```

**Behavior:**
- User explicitly types `/loop-in` to invoke
- Appears in `/help` as `/loop-in-mcp:loop-in` (or uses `name` from frontmatter)
- Both skills and commands use the same structure; the difference is auto-invoke vs. explicit

### Connection Management Command

Location: `plugins/loop-in-mcp/commands/loop-connect.md`

```markdown
---
description: Configure and test your Loop MCP connection
---

# Loop Connect Command

Help the user set up authentication for the Loop MCP server.

If the user hasn't configured their Loop token yet:
1. Explain that the plugin requires a Loop server URL and API token
2. Guide them to obtain a token from their Loop instance
3. Instruct them to run:
   ```
   claude mcp add-json loop '{"type":"http","url":"https://api.loop.local/mcp","headers":{"Authorization":"Bearer YOUR_TOKEN"}}'
   ```
   or direct them to re-enable the plugin to use the `userConfig` prompt.

If they already have the token:
1. Test the connection by attempting a simple tool call
2. Report success or suggest troubleshooting steps
```

---

## Directory Structure Reference

### Complete Plugin Layout

```
plugins/loop-in-mcp/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (required)
├── skills/
│   └── loop-in/
│       ├── SKILL.md             # Model-invoked skill
│       └── reference.md         # Optional supporting docs
├── commands/
│   ├── loop-in.md               # User slash command
│   └── loop-connect.md          # Connection setup command
├── .mcp.json                    # MCP server config (alternative: inline in plugin.json)
├── hooks/
│   └── hooks.json               # Optional: event handlers
├── bin/
│   └── loop-script              # Optional: add executables to PATH
├── scripts/
│   └── validate-connection.sh   # Optional: supporting scripts
├── README.md                     # Plugin documentation
├── LICENSE                       # License file
└── package.json                 # Optional: for dependencies
```

**Key rules:**
- Only `plugin.json` goes in `.claude-plugin/`
- All other directories (`skills/`, `commands/`, `hooks/`, `.mcp.json`, etc.) at plugin root
- Skills are subdirectories with `SKILL.md`; commands are flat `.md` files
- Use `${CLAUDE_PLUGIN_ROOT}` to reference bundled scripts in hooks/MCP configs

---

## Open Questions & Unspecified Behaviors

Based on the authoritative documentation, the following aspects are **either unspecified or have no explicit CLI support:**

1. **Slash command arguments** — The docs show slash commands work, but the exact mechanism for passing arguments from a slash command to the underlying skill/prompt is implied but not explicitly detailed. Assume `$ARGUMENTS` placeholder works (as with standalone skills).

2. **Dynamic MCP header updates** — The docs support static headers and `${VAR}` expansion at connection time, but **do not support dynamic token refresh mid-session**. If your Loop server requires token rotation during a session, you'll need to disconnect and reconnect (user runs a new command or plugin reload).

3. **OAuth for HTTP MCP servers in plugins** — The docs show OAuth support for user-added MCP servers (via `/mcp` and `--client-id`), but it's **unclear if plugin-bundled HTTP servers can declare OAuth requirements**. For now, assume bearer token via headers is the only mechanism supported inline in `plugin.json`.

4. **Slash command metadata** — The docs do not specify whether slash commands can declare additional metadata (like icons, categories, or usage hints) in frontmatter beyond `description`. Assume only `description` is recognized.

5. **Plugin-to-plugin communication** — The docs show plugin dependencies, but no mechanism for one plugin's slash command to directly invoke another plugin's skill. Work via MCP or file-based state.

6. **User config persistence across plugin updates** — The docs confirm `${CLAUDE_PLUGIN_DATA}` survives updates, but `userConfig` values are stored in `pluginConfigs[...].options` or the keychain. Clarify whether these persist when the plugin version changes.

---

## Documentation Sources

- [Plugins](https://code.claude.com/docs/en/plugins.md) — Creating plugins with skills, agents, hooks, MCP servers
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference.md) — Complete technical specification, schemas, CLI commands
- [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces.md) — Creating and distributing marketplaces, marketplace.json schema
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp.md) — MCP server configuration, HTTP transport, authentication, headers, user MCP config locations
- [Claude Code Documentation Index](https://code.claude.com/docs/llms.txt) — Index of all documentation

---

## Summary: What to Build

1. **Repository:** `Robbertvermeulen/loop-in-mcp`
2. **Marketplace:** `.claude-plugin/marketplace.json` with one plugin entry pointing to `./plugins/loop-in-mcp`
3. **Plugin manifest:** `plugins/loop-in-mcp/.claude-plugin/plugin.json` with name, version, and `userConfig` for server URL + token
4. **MCP server:** Inline in `plugin.json` as `mcpServers` with `type: "http"`, using `${user_config.loop_server_url}` and `${user_config.loop_token}` for the header
5. **Skills & commands:** Subdirectories in `plugins/loop-in-mcp/` with `skills/loop-in/SKILL.md` and `commands/loop-in.md` and `commands/loop-connect.md`
6. **Installation:** Users run `/plugin marketplace add Robbertvermeulen/loop-in-mcp` then `/plugin install loop-in-mcp@loop-in-mcp`, enter token when prompted
7. **Auth management:** Token stored securely via `userConfig` with `sensitive: true`; `/loop-connect` command can test/refresh if needed

---
