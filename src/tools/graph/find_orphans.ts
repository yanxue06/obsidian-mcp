import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles } from "../../core/cache.js";
import { isMarkdown } from "../../core/paths.js";

/**
 * Vault hygiene: notes with no incoming links. The Local REST API exposes no
 * backlinks endpoint, so we compute this by asking the plugin's search index
 * which notes link to each candidate — far cheaper than downloading every file.
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
