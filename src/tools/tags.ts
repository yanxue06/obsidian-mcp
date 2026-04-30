import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles } from "../cache.js";
import { isMarkdown, parseTags } from "../graph.js";

/**
 * Vault-wide tag inventory. The Local REST API doesn't expose a tags
 * endpoint, so we scan a sample of notes ourselves. Frontmatter tags are
 * picked up via `getNote`'s metadata channel; inline `#tag` tags via the
 * markdown body.
 */
export const listTagsTool = defineTool({
  name: "list_tags",
  title: "List all tags in the vault",
  description:
    "Return every tag used in the vault, with usage counts and a sample of notes per tag. Useful for 'what topics do I write about most?' or as a starting point for organizing.",
  inputSchema: z.object({
    sample_size: z
      .number()
      .int()
      .positive()
      .max(2000)
      .default(500)
      .describe("Max notes to scan. Increase for thoroughness on large vaults."),
    min_count: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("Drop tags with fewer than this many occurrences."),
    sample_notes_per_tag: z.number().int().min(0).max(10).default(3),
  }),
  async handler({ sample_size, min_count, sample_notes_per_tag }, { client }) {
    const all = (await getAllFiles(client)).filter(isMarkdown);
    const sample = all.slice(0, sample_size);

    const counts = new Map<string, { count: number; samples: string[] }>();

    await Promise.all(
      sample.map(async (path) => {
        let body = "";
        let metaTags: string[] = [];
        try {
          const note = await client.getNote(path);
          body = note.content ?? "";
          metaTags = note.tags ?? [];
        } catch {
          return;
        }
        const tags = new Set([...metaTags, ...parseTags(body)]);
        for (const t of tags) {
          let entry = counts.get(t);
          if (!entry) {
            entry = { count: 0, samples: [] };
            counts.set(t, entry);
          }
          entry.count++;
          if (entry.samples.length < sample_notes_per_tag) {
            entry.samples.push(path);
          }
        }
      }),
    );

    const tags = [...counts.entries()]
      .filter(([, v]) => v.count >= min_count)
      .map(([tag, v]) => ({ tag, count: v.count, samples: v.samples }))
      .sort((a, b) => b.count - a.count);

    return {
      scanned: sample.length,
      total_tags: tags.length,
      tags,
    };
  },
});
