<div align="center">

<img src="assets/banner.svg" alt="obsidian-mcp — your Obsidian vault as a knowledge graph, queryable by any MCP-compatible AI" width="100%">

# obsidian-mcp

### Treat your Obsidian vault as a knowledge graph that AI agents can actually use.

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude — and any other MCP-compatible AI — graph-aware access to your notes. Backlinks, multi-hop traversal, Dataview queries, daily-note awareness, and safe rename-with-backlink-rewrite, all in 23 typed tools.

[![npm version](https://img.shields.io/npm/v/obsidian-mcp.svg?style=flat-square&color=cb3837)](https://www.npmjs.com/package/obsidian-mcp)
[![CI](https://img.shields.io/github/actions/workflow/status/yanxue06/obsidian-mcp/ci.yml?style=flat-square&label=CI)](https://github.com/yanxue06/obsidian-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-7c3aed?style=flat-square)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](tsconfig.json)
[![GitHub stars](https://img.shields.io/github/stars/yanxue06/obsidian-mcp?style=flat-square)](https://github.com/yanxue06/obsidian-mcp/stargazers)

[**Setup**](#setup) · [**What you can do**](#what-you-can-do-with-it) · [**Tools**](#tool-catalog) · [**Design notes**](#design-notes) · [**FAQ**](#faq)

</div>

---

## Pitch

Most "Obsidian + AI" integrations expose `read_file` and `write_file`, then ask the model to figure out the rest. That works for a five-note vault. It collapses on a 5,000-note vault the moment you ask anything graph-shaped — *"what connects these two ideas?"*, *"what have I forgotten to follow up on?"*, *"reorganize this folder."* Each question becomes a chain of dozens of `read_file` calls, blowing through your context window before the model has even started thinking.

`obsidian-mcp` solves that by exposing **the graph itself** as tools:

- **`get_note`** returns content + backlinks + forward links + tags + frontmatter in *one* call.
- **`traverse_graph`** walks N hops out from any starting note in one call — forward, backward, or both — returning nodes and edges as a subgraph.
- **`query_dataview`** passes Dataview DQL straight through, so the model can ask *"all notes tagged #project where status != done sorted by due date"* as a single typed query.
- **`move_note`** renames a note **and rewrites every incoming wiki-link** so the graph survives the rename. This unblocks the entire "reorganize my vault" class of prompts that other servers can't safely do.

It's a small server (TypeScript, ~1,000 LOC, two runtime deps), runs locally over stdio, and works with Claude Desktop, Claude Code, Cursor, Cline, Continue, and Zed.

## What you can do with it

Real prompts you can drop into Claude Desktop after installing:

> **Build an index note (Map of Content).** *Build me an index note for everything I've written about distributed systems. Use `traverse_graph` from "Distributed systems.md" with depth 2, cluster the neighbors thematically, and write the result to `MOCs/Distributed Systems MOC.md`.* (MOC = Map of Content, a curated index note — Obsidian convention.)

> **Surface forgotten work.** *Find every note tagged `#project` where `status != "done"` and the due date is this week.* (Single `query_dataview` call.)

> **Daily review.** *What's in my daily note today? Anything I forgot to follow up on from yesterday's note? Append my action items to today.*

> **Inbox triage.** *Find all my orphan notes in `Inbox/`. For each one, read it, suggest where it belongs, and ask me before moving anything.*

> **Safe refactor.** *Rename "Atomic notes.md" to "Evergreen notes.md" using `move_note`. Update every backlink so nothing breaks.*

> **Vault analytics.** *Run `get_vault_stats` and `list_tags`. Tell me my top 5 topics by note count, where I write most, and how my vault has grown.*

> **Cross-domain synthesis.** *Walk 2 hops from "Working memory.md" and 2 hops from "Attention.md". Tell me which notes appear in both neighborhoods — those are my cross-cutting ideas.*

If a workflow doesn't fit one of the existing tools, [open an issue](https://github.com/yanxue06/obsidian-mcp/issues) — the [tool catalog](#tool-catalog) below covers what's there today.

## Setup

You need three things wired up: Obsidian running, the Local REST API plugin enabled, and your MCP client pointed at `obsidian-mcp`. The whole flow takes about a minute.

### Step 1 — Install the Local REST API plugin in Obsidian

`obsidian-mcp` reaches your vault through the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) community plugin. You only do this once per vault.

1. In Obsidian, open **Settings → Community plugins → Browse**.
2. Search for **Local REST API**, then **Install** and **Enable** it.
3. Open the plugin's settings tab. Copy the **API key** shown at the top — you'll paste it into your MCP client config in Step 2.

> **Heads up:** Obsidian must be running for `obsidian-mcp` to work. The plugin lives *inside* Obsidian; close the app and the server can't reach your vault.

### Step 2 — Add `obsidian-mcp` to your MCP client

Pick your client below.

<details open>
<summary><b>Claude Desktop</b></summary>

Open the config file (create it if it doesn't exist):

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add the `obsidian` entry under `mcpServers`:

```jsonc
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp"],
      "env": {
        "OBSIDIAN_API_KEY": "paste-your-key-here"
      }
    }
  }
}
```

Quit and reopen Claude Desktop. You should see a tool icon in the input area — click it to confirm the `obsidian` tools are listed.

</details>

<details>
<summary><b>Claude Code</b></summary>

Run once, from any directory:

```bash
claude mcp add obsidian -e OBSIDIAN_API_KEY=paste-your-key-here -- npx -y obsidian-mcp
```

Then fully quit and reopen Claude Code (`/mcp reconnect` doesn't always re-spawn the child process). Verify with `/mcp` — `obsidian` should report **✓ Connected**.

</details>

<details>
<summary><b>Cursor / Cline / Continue / Zed (and other MCP clients)</b></summary>

Add a new stdio MCP server with:

- **Command:** `npx`
- **Args:** `-y obsidian-mcp`
- **Env:** `OBSIDIAN_API_KEY=paste-your-key-here`

Refer to your client's MCP config docs for the exact field names. Any MCP-compatible client works.

</details>

### Step 3 — Verify it's wired up

In your MCP client, ask:

> *"Run `get_vault_stats` and tell me how many notes I have."*

If you get a number back, you're done. If you hit a connection error, check [troubleshooting](#troubleshooting) below.

### Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:27124` | Obsidian isn't running, or the Local REST API plugin isn't enabled. |
| `401 Unauthorized` | Wrong API key. Re-copy it from the plugin's settings tab. |
| `self signed certificate` warning | Expected — the plugin uses a self-signed cert and `OBSIDIAN_VERIFY_TLS` defaults to `false`. Set it to `true` only if you've replaced the cert. |
| `Failed to reconnect to obsidian` after editing config | Fully quit and reopen the MCP client; in-place reconnect doesn't always re-spawn the child process. |
| Wrong vault is showing up | One server instance points at one running Obsidian instance. Switch vaults inside Obsidian, or register multiple MCP entries with different names. |

### From source (contributors only)

If you want to hack on the server itself rather than just use it:

```bash
git clone https://github.com/yanxue06/obsidian-mcp.git
cd obsidian-mcp
npm install
npm test          # 15 tests pass
npm run build
OBSIDIAN_API_KEY=... node dist/index.js
```

## Tool catalog

23 tools, organized by category. **Bold** rows are the differentiators that other Obsidian MCP servers don't expose.

### Discovery — find what's in the vault
| Tool | What it does |
| --- | --- |
| `list_vault` | All files (or one folder), markdown-only by default. |
| `search_vault` | Full-text or `#tag` search, with snippets. |
| **`query_dataview`** | Run a Dataview DQL query. Requires the Dataview plugin in the vault. |
| **`list_tags`** | Vault-wide tag inventory with usage counts and sample notes per tag. |
| **`get_vault_stats`** | Totals (files, notes), sampled word count, top folders, file extensions. |

### Reading — get content out
| Tool | What it does |
| --- | --- |
| **`get_note`** | Content **plus graph context** — backlinks, forward links, tags, frontmatter — in one call. The flagship tool. |
| **`get_outline`** | Heading tree of a note. Use this instead of `get_note` when you only need to navigate. |
| `get_active_note` | The note currently focused in Obsidian. |
| **`get_daily_note`** | Today's daily / weekly / monthly / quarterly / yearly note. |

### Graph — walk and analyze the link structure
| Tool | What it does |
| --- | --- |
| **`get_backlinks`** | Notes that link to a given note, with snippets. |
| **`traverse_graph`** | Walk N hops from a note (forward, backward, or both). Returns nodes + edges. |
| **`find_orphans`** | Notes with no incoming links — forgotten ideas, candidates for cleanup. |
| **`find_broken_links`** | Wiki-links that don't resolve. Run this before bulk renames. |

### Writing — create and modify notes
| Tool | What it does |
| --- | --- |
| `create_note` | New note with optional frontmatter and an auto-generated `## Related` section of `[[wiki-links]]`. |
| `update_note` | Replace a note's full content. |
| `append_to_note` | Append markdown to the end of a note. |
| `append_to_daily_note` | Common pattern: agent logs what it did to today's daily. |
| **`patch_note`** | Insert content under a specific heading, block, or frontmatter field — without rewriting the rest. |
| **`move_note`** | Move/rename a note **and update incoming wiki-links** so the graph stays intact. |
| `delete_note` | Destructive — only used when explicitly asked. |

### UI / commands — drive Obsidian itself
| Tool | What it does |
| --- | --- |
| **`open_note`** | Surface a note in Obsidian's workspace. Great closing move for an agent task. |
| `list_commands` | List every registered Obsidian command (built-in + plugin). |
| **`run_command`** | Execute any Obsidian command by id. Lets agents trigger any plugin action. |

## How it compares

| | obsidian-mcp | Other Obsidian MCP servers | Obsidian Copilot (plugin) |
| --- | --- | --- | --- |
| Backlinks in one call | yes | no | yes |
| Multi-hop graph traversal | **yes** | no | no |
| Dataview DQL passthrough | **yes** | no | partial |
| Daily / periodic notes | yes | no | no |
| Patch under heading / block | yes | no | no |
| Move with backlink rewrite | **yes** | no | no |
| Run Obsidian commands | **yes** | no | no |
| Vault stats + tag inventory | **yes** | no | no |
| Find orphans / broken links | yes | no | no |
| Works with any MCP client | yes | yes | no (Obsidian-only) |
| Requires extra Obsidian plugins | Local REST API only | Local REST API only | yes |
| Lines of runtime code | ~1,000 | ~200–400 | ~10,000+ |

## How it works

```
┌──────────────────┐    stdio (MCP)    ┌──────────────┐    HTTPS     ┌──────────────────┐
│ Claude / Cursor  │ ─────────────────► obsidian-mcp ────────────────►  Local REST API  │ ──► Vault
│ Cline / Zed / …  │                   │  (this repo) │              │ (Obsidian plugin)│
└──────────────────┘                   └──────────────┘              └──────────────────┘
```

`obsidian-mcp` is a thin layer over the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api). The plugin runs an HTTPS server inside Obsidian with full vault access; this server adapts that surface into the MCP protocol and adds graph-aware tools that Obsidian's REST API doesn't expose directly (backlinks, multi-hop traversal, orphan detection, safe rename).

Everything is local. No data leaves your machine except the requests your MCP client makes to its model provider — and you control that.

## Design notes

A few of the trade-offs worth calling out, for anyone reading the code or evaluating the approach.

**Why ride on the Local REST API plugin instead of an Obsidian plugin of our own?** Two reasons. (1) An MCP server has to be a separate process — the protocol expects a stdio child process, not an in-process module. So even if we wrote a plugin, it would still need a sidecar. (2) The Local REST API plugin already exists, is maintained, has a clean HTTP surface, and handles auth and TLS. Reusing it means zero install friction for users who already have it, and a 60-second setup for those who don't.

**Why a separate `get_note` shape with `include` instead of always returning everything?** Backlinks are O(vault size) — for a 5k-note vault, computing them naively is hundreds of search hits. The default `include` set (`content`, `forward_links`, `tags`, `frontmatter`) is cheap; `backlinks` is opt-in. This puts cost control in the model's hands without making the simple case verbose.

**Why a 30-second TTL cache on `listVault`?** Every link resolution and graph walk needs the canonical file list. A multi-step agent prompt might call 5–10 tools in sequence; without caching, each one re-fetches the whole vault listing from Obsidian. With it, a chain of tool calls amortizes onto one HTTP round-trip.

**Why does `move_note` rewrite backlinks?** Because LLMs almost always *think* they should rename, then break the graph and not notice. Making the safe path the default — and the unsafe path a `update_backlinks: false` opt-out — turns a footgun into a noop. We resolve each candidate link in the *pre-move* file list before rewriting, to avoid clobbering links that happened to share a basename.

**Why no embeddings / semantic search?** Embeddings would be useful, but they require a vector store, an embedding pipeline, and incremental indexing — meaningful complexity that pulls a single-file-server into a stateful system. The plugin's full-text search covers the common case; embeddings would be a meaningful next step once first-pass user feedback is in.

**Why Zod schemas instead of hand-written JSON Schema?** Two-way type inference. The handler's `input` parameter is automatically typed from the schema, so refactors that change a tool's input shape produce compile errors at the call site, not runtime errors at tool-call time. The MCP SDK lowers Zod to JSON Schema for clients automatically.

**What's *not* there.** No write-locking — if two agents move the same file simultaneously, the loser's change is lost. No transaction semantics — `move_note`'s "delete source" step happens after the backlink rewrite, so a crash mid-operation can leave the destination written but the source un-deleted. Both are acceptable for an interactive agent tool but would not be acceptable for an unattended batch job.

## Configuration

All config is via environment variables — set them in your MCP client config.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `OBSIDIAN_API_KEY` | yes | — | From Local REST API plugin settings. |
| `OBSIDIAN_HOST` | no | `127.0.0.1` | |
| `OBSIDIAN_PORT` | no | `27124` (https) / `27123` (http) | |
| `OBSIDIAN_PROTOCOL` | no | `https` | The plugin defaults to HTTPS with a self-signed cert. |
| `OBSIDIAN_VERIFY_TLS` | no | `false` | Set to `true` if you've replaced the self-signed cert. |
| `OBSIDIAN_TIMEOUT_MS` | no | `15000` | Per-request timeout. |

## Performance & scale

| Vault size | `get_note` (with backlinks) | `traverse_graph` depth=2 | `find_orphans` |
| --- | --- | --- | --- |
| 100 notes | ~50ms | ~150ms | ~1s |
| 1,000 notes | ~150ms | ~600ms | ~6s |
| 5,000 notes | ~400ms | ~2s | ~25s* |

*`find_orphans` and `find_broken_links` accept a `sample_size` parameter — bound them on large vaults to keep tool calls under the model's per-call timeout.

## FAQ

**Do I need to install an Obsidian plugin?** Yes — the Local REST API plugin. It's the only sane way to talk to a running vault from outside. `obsidian-mcp` itself runs as a separate Node process started by your MCP client; you don't install another plugin in Obsidian for this.

**Does it work if Obsidian is closed?** No. The Local REST API runs *inside* Obsidian, so the app needs to be open.

**Does it support multiple vaults?** One server instance points at one running Obsidian instance. Run multiple MCP server entries (different names) if you switch vaults frequently. Multi-vault routing may come later.

**Why HTTPS by default with `OBSIDIAN_VERIFY_TLS=false`?** The plugin ships a self-signed cert. The traffic is loopback-only (`127.0.0.1`), so verification adds friction without a real security gain. If you've replaced the cert, set the flag.

**Is this safe?** The MCP server gives the model whatever access the API key grants — including delete and overwrite. Treat it like any agent with file write access: review what it's about to do, especially before bulk operations. `move_note` is designed for exactly this — making the safe path the default.

**How do I debug?** Run `node dist/index.js` directly with your env vars and the server prints connection status to stderr. Send JSON-RPC messages on stdin to test. The MCP Inspector ([npm](https://www.npmjs.com/package/@modelcontextprotocol/inspector)) is the easiest way to poke at tools manually.

## Acknowledgements

- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) by **@coddingtonbear** — this entire project is downstream of it.
- The [Model Context Protocol](https://modelcontextprotocol.io) team at Anthropic.
- The Obsidian plugin community, who built the ecosystem this depends on.

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
<sub>If this project saved you time or token spend, a star helps others find it.</sub>
</div>
