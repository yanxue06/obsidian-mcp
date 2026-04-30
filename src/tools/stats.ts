import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles } from "../cache.js";
import { countWords, dirname, isMarkdown } from "../graph.js";

export const getVaultStatsTool = defineTool({
  name: "get_vault_stats",
  title: "Get vault statistics",
  description:
    "Get high-level stats about the vault: total notes, total words (sampled), top folders, file extensions. Useful for 'how big is my vault?' / 'where do I write the most?' prompts.",
  inputSchema: z.object({
    sample_size: z
      .number()
      .int()
      .positive()
      .max(2000)
      .default(300)
      .describe("How many notes to sample for word count. 0 = skip word count."),
    top_folders: z.number().int().min(1).max(50).default(10),
  }),
  async handler({ sample_size, top_folders }, { client }) {
    const all = await getAllFiles(client);
    const md = all.filter(isMarkdown);
    const otherCounts = new Map<string, number>();
    for (const f of all) {
      if (isMarkdown(f)) continue;
      const ext = (/\.([a-z0-9]+)$/i.exec(f)?.[1] ?? "(none)").toLowerCase();
      otherCounts.set(ext, (otherCounts.get(ext) ?? 0) + 1);
    }

    const folderCounts = new Map<string, number>();
    for (const f of md) {
      const d = dirname(f) || "(root)";
      folderCounts.set(d, (folderCounts.get(d) ?? 0) + 1);
    }
    const topFolders = [...folderCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top_folders)
      .map(([folder, count]) => ({ folder, count }));

    let totalWords = 0;
    let sampled = 0;
    if (sample_size > 0) {
      const subset = md.slice(0, sample_size);
      sampled = subset.length;
      // Concurrent fetch in small batches to avoid hammering the plugin.
      const BATCH = 8;
      for (let i = 0; i < subset.length; i += BATCH) {
        const slice = subset.slice(i, i + BATCH);
        const texts = await Promise.all(
          slice.map((p) => client.getNoteText(p).catch(() => "")),
        );
        for (const t of texts) totalWords += countWords(t);
      }
    }
    const avgWords = sampled > 0 ? Math.round(totalWords / sampled) : 0;

    return {
      total_files: all.length,
      total_notes: md.length,
      file_extensions: [...otherCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([ext, count]) => ({ ext, count })),
      top_folders: topFolders,
      sample_size: sampled,
      sampled_total_words: totalWords,
      sampled_avg_words: avgWords,
      estimated_total_words:
        sampled > 0 ? Math.round((totalWords / sampled) * md.length) : null,
    };
  },
});
