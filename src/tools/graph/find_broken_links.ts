import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles } from "../../core/cache.js";
import { isMarkdown, resolveLink } from "../../core/paths.js";
import { parseLinks } from "../../core/markdown.js";

export const findBrokenLinksTool = defineTool({
  name: "find_broken_links",
  title: "Find broken links",
  description:
    "Find wiki-links and markdown links that don't resolve to any note in the vault. Use for vault hygiene or before refactoring note titles.",
  inputSchema: z.object({
    folder: z.string().optional(),
    limit: z.number().int().positive().max(500).default(100),
    sample_size: z.number().int().positive().max(2000).default(300),
  }),
  async handler({ folder, limit, sample_size }, { client }) {
    const all = (await getAllFiles(client)).filter(isMarkdown);
    const scope = folder
      ? all.filter((f) => f.startsWith(folder.replace(/\/+$/g, "") + "/"))
      : all;
    const sample = scope.slice(0, sample_size);

    const broken: Array<{ source: string; target: string }> = [];
    for (const path of sample) {
      let body: string;
      try {
        body = await client.getNoteText(path);
      } catch {
        continue;
      }
      for (const link of parseLinks(body)) {
        if (!resolveLink(link.target, all)) {
          broken.push({ source: path, target: link.target });
          if (broken.length >= limit) break;
        }
      }
      if (broken.length >= limit) break;
    }

    return {
      scanned: sample.length,
      broken_count: broken.length,
      broken,
    };
  },
});
