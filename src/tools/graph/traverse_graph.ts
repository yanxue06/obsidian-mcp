import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles } from "../../core/cache.js";
import { basename, isMarkdown, resolveLink } from "../../core/paths.js";
import { parseLinks } from "../../core/markdown.js";

/**
 * The differentiating tool — most Obsidian MCP servers expose only file CRUD;
 * we let the model ask "give me everything within N hops of this note" in a
 * single call.
 */
export const traverseGraphTool = defineTool({
  name: "traverse_graph",
  title: "Traverse the vault graph",
  description:
    "Walk the link graph starting from a note. Returns nodes (notes) and edges (links) up to `depth` hops away. Use `direction=both` for a neighborhood, `forward` for what a note depends on, `backward` for what depends on it. Cap with `max_nodes` on large vaults.",
  inputSchema: z.object({
    start: z.string().describe("Vault-relative path of the starting note."),
    depth: z.number().int().min(1).max(4).default(2),
    direction: z
      .enum(["forward", "backward", "both"])
      .default("both")
      .describe("forward = follow outgoing links; backward = follow backlinks."),
    max_nodes: z.number().int().positive().max(500).default(150),
    include_snippets: z
      .boolean()
      .default(false)
      .describe("If true, include a short preview snippet for each node."),
  }),
  async handler(
    { start, depth, direction, max_nodes, include_snippets },
    { client },
  ) {
    const allFiles = await getAllFiles(client);
    const visited = new Map<string, { depth: number; snippet?: string }>();
    const edges: Array<{ from: string; to: string; kind: "forward" | "backward" }> = [];

    const queue: Array<{ path: string; depth: number }> = [
      { path: start, depth: 0 },
    ];

    while (queue.length > 0 && visited.size < max_nodes) {
      const { path, depth: d } = queue.shift()!;
      if (visited.has(path)) continue;

      let snippet: string | undefined;
      let body = "";
      try {
        body = await client.getNoteText(path);
        if (include_snippets) snippet = body.slice(0, 200);
      } catch {
        // Note may not exist (broken link target); record it, don't expand.
        visited.set(path, { depth: d });
        continue;
      }
      visited.set(path, { depth: d, snippet });
      if (d >= depth) continue;

      if (direction === "forward" || direction === "both") {
        const links = parseLinks(body);
        for (const l of links) {
          const resolved = resolveLink(l.target, allFiles);
          if (!resolved) continue;
          edges.push({ from: path, to: resolved, kind: "forward" });
          if (!visited.has(resolved)) {
            queue.push({ path: resolved, depth: d + 1 });
          }
        }
      }

      if (direction === "backward" || direction === "both") {
        const stem = basename(path).replace(/\.md$/i, "");
        const hits = await client.simpleSearch(`[[${stem}`, 0);
        for (const h of hits) {
          if (h.filename === path) continue;
          if (!isMarkdown(h.filename)) continue;
          edges.push({ from: h.filename, to: path, kind: "backward" });
          if (!visited.has(h.filename)) {
            queue.push({ path: h.filename, depth: d + 1 });
          }
        }
      }
    }

    return {
      start,
      direction,
      depth,
      truncated: visited.size >= max_nodes,
      nodes: [...visited.entries()].map(([path, v]) => ({
        path,
        depth: v.depth,
        snippet: v.snippet,
      })),
      edges,
    };
  },
});
