# mcp-gas-deploy plugin

Google Apps Script MCP server for Claude Code — 14 tools for the full GAS development lifecycle.

## Prerequisites

- Node.js ≥ 18
- `claude` CLI (Claude Code) in PATH

## Auto-registration

When this plugin is installed via `claude-craft install.sh`, a `SessionStart` hook fires on the
next Claude Code launch. If `mcp-gas-deploy` is not yet registered, the hook:

1. Builds `dist/server.js` if absent (`npm run build` in the repo root, ~10s)
2. Runs `claude mcp add -s user` to register the server at user scope
3. Emits a one-time advisory: **"Restart Claude Code to activate"**

On every subsequent session the hook exits silently (zero output, near-zero cost).

## Manual registration

If auto-registration fails or you prefer a manual setup:

```bash
cd ~/src/mcp-gas-deploy
npm run setup
```

## Tools (14)

| Tool | Description |
|------|-------------|
| `auth` | Authenticate with Google (PKCE or bootstrap flow) |
| `create` | Scaffold a new GAS project with CommonJS runtime |
| `ls` | List managed projects |
| `pull` | Download remote GAS files to local directory |
| `push` | Upload local `.gs`/`.html` files to GAS |
| `status` | Show local vs remote diff |
| `lint` | Validate CommonJS module patterns pre-push |
| `exec` | Execute a function in a GAS deployment |
| `deploy` | Create a versioned deployment (4-slot circular buffer) |
| `promote` | Copy staging deployment to production |
| `project_copy` | Copy a project to a new script |
| `trigger` | Manage GAS time-driven and event triggers |
| `fork` | Fork a project into a new GAS script |
| `setup` | Configure GCP project linkage for `scripts.run` exec path |

## Architecture

The server runs as an MCP stdio process (`dist/server.js`), registered at user scope in
`~/.claude.json`. It persists OAuth tokens in `.mcp-gas/tokens/{email}.json` inside each
workspace and tracks deployment state in `gas-deploy.json` per project.

See the [source repo](https://github.com/whichguy/mcp-gas-deploy) for full documentation.
