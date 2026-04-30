import { z } from "zod";
import { defineTool } from "./types.js";
import { basename, isMarkdown } from "../graph.js";

export const getBacklinksTool = defineTool({
  name: "get_backlinks",
  title: "Get notes that link to a note",
  description:
    "Return notes that link to the given path, with snippets. Same data as the `backlinks` field of `get_note` — use this when that's all you need.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path of the target note."),
    limit: z.number().int().positive().max(500).default(100),
  }),
  async handler({ path, limit }, { client }) {
    const stem = basename(path).replace(/\.md$/i, "");
    const hits = await client.simpleSearch(`[[${stem}`, 80);
    const filtered = hits
      .filter((h) => h.filename !== path && isMarkdown(h.filename))
      .slice(0, limit)
      .map((h) => ({
        source: h.filename,
        snippet: h.matches?.[0]?.context,
        match_count: h.matches?.length ?? 0,
      }));
    return {
      target: path,
      count: filtered.length,
      backlinks: filtered,
    };
  },
});
