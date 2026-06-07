import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles } from "../../core/cache.js";
import { basename, resolveLink } from "../../core/paths.js";
import { parseLinks, parseTags } from "../../core/markdown.js";

/**
 * The flagship tool. Other Obsidian MCP servers return just file contents — we
 * also compute backlinks, forward links, and tags so the model doesn't have to
 * make N follow-up calls to understand a note's place in the graph.
 */
export const getNoteTool = defineTool({
  name: "get_note",
  title: "Get note with graph context",
  description:
    "Get a note's content plus its graph context: backlinks (who links to it), forward links (who it links to), tags, and frontmatter. Use the `include` array to control which context is fetched — backlinks are O(vault size) so omit them when unneeded.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path to the note."),
    include: z
      .array(
        z.enum(["backlinks", "forward_links", "tags", "frontmatter", "content"]),
      )
      .default(["content", "forward_links", "tags", "frontmatter"])
      .describe(
        "Which fields to populate. Backlinks are expensive on large vaults.",
      ),
    backlinks_limit: z.number().int().positive().max(500).default(50),
  }),
  async handler({ path, include, backlinks_limit }, { client }) {
    const want = new Set(include);

    const note = await client.getNote(path);
    const out: {
      path: string;
      content?: string;
      tags?: string[];
      frontmatter?: Record<string, unknown>;
      forward_links?: Array<{ target: string; resolved: string | null }>;
      backlinks?: Array<{ source: string; snippet?: string }>;
    } = { path: note.path };

    if (want.has("content")) out.content = note.content;
    if (want.has("frontmatter")) out.frontmatter = note.frontmatter ?? {};
    if (want.has("tags")) {
      const fromBody = parseTags(note.content ?? "");
      const fromMeta = note.tags ?? [];
      out.tags = [...new Set([...fromMeta, ...fromBody])];
    }

    if (want.has("forward_links")) {
      const all = await getAllFiles(client);
      const links = parseLinks(note.content ?? "");
      out.forward_links = links.map((l) => ({
        target: l.target,
        resolved: resolveLink(l.target, all),
      }));
    }

    if (want.has("backlinks")) {
      const target = basename(note.path).replace(/\.md$/i, "");
      // Use the plugin's indexed search to find wiki-links by basename/path —
      // much cheaper than downloading every note.
      const hits = await client.simpleSearch(`[[${target}`, 80);
      out.backlinks = hits
        .filter((h) => h.filename !== note.path)
        .slice(0, backlinks_limit)
        .map((h) => ({
          source: h.filename,
          snippet: h.matches?.[0]?.context,
        }));
    }

    return out;
  },
});
