import { z } from "zod";
import { defineTool } from "../types.js";

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
