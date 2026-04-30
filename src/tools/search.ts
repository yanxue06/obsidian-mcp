import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles } from "../cache.js";
import { isMarkdown } from "../graph.js";

export const searchVaultTool = defineTool({
  name: "search_vault",
  title: "Search the vault",
  description:
    "Full-text search across all notes. Supports two modes: `keyword` (fast plain-text) and `tag` (find notes tagged with #X). For structured queries, use `query_dataview`.",
  inputSchema: z.object({
    query: z.string().describe("Search string. For tag mode, omit the leading '#'."),
    mode: z
      .enum(["keyword", "tag"])
      .default("keyword")
      .describe(
        "keyword: plain-text. tag: notes containing the inline tag #<query>.",
      ),
    context_length: z
      .number()
      .int()
      .min(0)
      .max(500)
      .default(80)
      .describe("Characters of surrounding context to return per match."),
    limit: z.number().int().positive().max(200).default(50),
  }),
  async handler({ query, mode, context_length, limit }, { client }) {
    const q = mode === "tag" ? `#${query.replace(/^#/, "")}` : query;
    const hits = await client.simpleSearch(q, context_length);
    return {
      query: q,
      mode,
      count: hits.length,
      hits: hits.slice(0, limit).map((h) => ({
        path: h.filename,
        score: h.score,
        snippet: h.matches?.[0]?.context,
        match_count: h.matches?.length ?? 0,
      })),
    };
  },
});

export const queryDataviewTool = defineTool({
  name: "query_dataview",
  title: "Run a Dataview DQL query",
  description:
    "Run a Dataview DQL query (LIST / TABLE / TASK) against the vault. Requires the Dataview plugin installed in the vault. Powerful for structured questions like 'all notes tagged #project where status != done sorted by due date'.",
  inputSchema: z.object({
    dql: z
      .string()
      .describe(
        "A Dataview DQL query string, e.g.\n  TABLE status, due FROM #project WHERE status != \"done\" SORT due ASC",
      ),
  }),
  async handler({ dql }, { client }) {
    const rows = await client.dataview(dql);
    return { count: rows.length, rows };
  },
});

/**
 * Vault hygiene: notes with no incoming links. The Local REST API doesn't
 * expose a backlinks endpoint, so we compute this ourselves by scanning every
 * note. Cached file list keeps it cheap for repeat calls.
 */
export const findOrphansTool = defineTool({
  name: "find_orphans",
  title: "Find orphan notes",
  description:
    "Find notes with no incoming links anywhere in the vault. Use to surface forgotten ideas or candidates for cleanup.",
  inputSchema: z.object({
    folder: z
      .string()
      .optional()
      .describe("If set, only consider notes inside this folder as orphans."),
    limit: z.number().int().positive().max(500).default(100),
    sample_size: z
      .number()
      .int()
      .positive()
      .max(2000)
      .default(500)
      .describe(
        "Limit how many notes are scanned for incoming links. Increase for thoroughness on large vaults.",
      ),
  }),
  async handler({ folder, limit, sample_size }, { client }) {
    const all = (await getAllFiles(client)).filter(isMarkdown);
    const candidates = folder
      ? all.filter((f) => f.startsWith(folder.replace(/\/+$/g, "") + "/"))
      : all;

    const linked = new Set<string>();
    // Walk a sample of notes; for each one, ask Obsidian's search engine
    // which notes link to it. Bulk simpleSearch is much faster than
    // downloading every file.
    for (const cand of candidates.slice(0, sample_size)) {
      const stem = cand.replace(/\.md$/i, "").split("/").pop() ?? cand;
      const hits = await client.simpleSearch(`[[${stem}`, 0);
      for (const h of hits) if (h.filename !== cand) linked.add(cand);
      if (linked.size >= candidates.length) break;
    }

    const orphans = candidates.filter((c) => !linked.has(c)).slice(0, limit);
    return {
      scanned: Math.min(candidates.length, sample_size),
      total_candidates: candidates.length,
      orphans,
    };
  },
});
