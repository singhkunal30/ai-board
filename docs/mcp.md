# AI-Board MCP server

An [MCP](https://modelcontextprotocol.io) server (`apps/mcp`) that lets MCP
clients — **Claude Code**, Claude Desktop, etc. — read and edit AI-Board boards
through tools. It talks to the AI-Board REST API authenticated with a personal
**API key**, so it acts as a specific user with that user's permissions.

## Tools exposed

| Tool | What it does |
| --- | --- |
| `list_workspaces` | List workspaces you can access |
| `list_boards` | List boards in a workspace |
| `create_board` | Create a board (optionally from a template) |
| `get_board` | Read a board's items (id, type, text) and edges |
| `board_command` | **Edit a board in natural language** ("add three notes about pricing", "connect Login to Database") |
| `generate_mindmap` / `generate_diagram` | Generate and place a mind map / diagram |
| `summarize_board` | Overview, themes, gaps, next steps |
| `ask_board` | RAG question-answering over the board + its documents |
| `add_notes` | Add sticky notes (deterministic, no AI) |

## Setup

### 1. Build the server

```bash
pnpm --filter @ai-board/mcp build
```

### 2. Create an API key

The MCP server authenticates with an AI-Board API key (format `aib_…`). With the
API running and an access token (from login), create one:

```bash
curl -s -X POST http://localhost:4000/api/api-keys \
  -H "authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H 'content-type: application/json' \
  -d '{"name":"Claude Code"}'
# → { "token": "aib_xxxx_yyyy", ... }  ← copy this once; it is not shown again
```

Manage keys: `GET /api/api-keys` (list), `DELETE /api/api-keys/:id` (revoke).

### 3a. Connect from Claude Code

Add the server (project scope writes `.mcp.json` in the repo):

```bash
claude mcp add ai-board \
  --env AI_BOARD_URL=http://localhost:4000 \
  --env AI_BOARD_API_KEY=aib_xxxx_yyyy \
  -- node apps/mcp/dist/index.js
```

…or copy `.mcp.json.example` to `.mcp.json` and fill in your key. Then in Claude
Code the `ai-board` tools become available (e.g. *"use ai-board to create a
board called Roadmap and add notes for Q1–Q4"*).

> `.mcp.json` contains a secret — it is git-ignored; never commit a real key.

### 3b. Connect from Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-board": {
      "command": "node",
      "args": ["/absolute/path/to/ai-board/apps/mcp/dist/index.js"],
      "env": {
        "AI_BOARD_URL": "http://localhost:4000",
        "AI_BOARD_API_KEY": "aib_xxxx_yyyy"
      }
    }
  }
}
```

## Configuration

| Env var | Description |
| --- | --- |
| `AI_BOARD_URL` | Base URL of the AI-Board API (default `http://localhost:4000`) |
| `AI_BOARD_API_KEY` | A personal access token (`aib_…`) |

## Security notes

- API keys are stored only as an argon2 hash of their secret; the plaintext is
  shown once at creation.
- A key carries its owner's full RBAC permissions. Revoke unused keys.
- The server logs only to stderr (stdout is the MCP protocol channel).
