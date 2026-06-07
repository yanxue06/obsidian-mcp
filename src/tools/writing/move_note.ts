import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles, invalidateFileCache } from "../../core/cache.js";
import { basename, isMarkdown, resolveLink } from "../../core/paths.js";

/**
 * The Local REST API has no rename/move endpoint, so we implement it
 * client-side: read the source, write the destination, optionally rewrite
 * incoming wiki-links so the rename doesn't break the graph, then delete the
 * source. Backlinks are found via the search index and patched in place.
 */
export const moveNoteTool = defineTool({
  name: "move_note",
  title: "Move or rename a note (with backlink updates)",
  description:
    "Move a note from one path to another, optionally rewriting wiki-links so backlinks keep working. This is the safe way to rename notes — agents should not naively `delete + create` because that breaks the graph.",
  inputSchema: z.object({
    from: z.string().describe("Current vault-relative path."),
    to: z.string().describe("Destination vault-relative path. '.md' appended if missing."),
    update_backlinks: z
      .boolean()
      .default(true)
      .describe("Rewrite [[wiki-links]] in other notes to point at the new path."),
    overwrite: z
      .boolean()
      .default(false)
      .describe("If false, fail when destination already exists."),
  }),
  async handler({ from, to, update_backlinks, overwrite }, { client }) {
    const dest = isMarkdown(to) ? to : `${to}.md`;
    if (dest === from) {
      return { ok: true, moved: false, reason: "from === to" };
    }

    const all = await getAllFiles(client);
    if (!overwrite && all.includes(dest)) {
      throw new Error(
        `Destination already exists: ${dest}. Pass overwrite:true to replace.`,
      );
    }

    const content = await client.getNoteText(from);
    await client.putNote(dest, content);

    let backlinks_updated = 0;
    const edits: Array<{ note: string; replaced: number }> = [];
    if (update_backlinks) {
      const oldStem = basename(from).replace(/\.md$/i, "");
      const newStem = basename(dest).replace(/\.md$/i, "");
      const hits = await client.simpleSearch(`[[${oldStem}`, 0);
      for (const h of hits) {
        if (h.filename === from || h.filename === dest) continue;
        if (!isMarkdown(h.filename)) continue;
        let body: string;
        try {
          body = await client.getNoteText(h.filename);
        } catch {
          continue;
        }
        const { replaced, body: rewritten } = rewriteWikiLinks(
          body,
          newStem,
          all,
          from,
        );
        if (replaced > 0) {
          await client.putNote(h.filename, rewritten);
          backlinks_updated += replaced;
          edits.push({ note: h.filename, replaced });
        }
      }
    }

    await client.deleteNote(from);
    invalidateFileCache();

    return {
      ok: true,
      from,
      to: dest,
      backlinks_updated,
      edits: edits.slice(0, 50),
      truncated_edits: edits.length > 50,
    };
  },
});

/**
 * Rewrite `[[oldStem...]]` → `[[newStem...]]` only where the link actually
 * resolved to the file being moved (using the pre-move file list, so two notes
 * sharing a basename don't cause false positives). Aliases and headings are
 * preserved.
 */
function rewriteWikiLinks(
  body: string,
  newStem: string,
  allFiles: string[],
  movedPath: string,
): { body: string; replaced: number } {
  let replaced = 0;
  const out = body.replace(/\[\[([^\]\n]+)\]\]/g, (full, inner: string) => {
    // inner = "Target#Heading|Alias" — split it carefully.
    const pipe = inner.indexOf("|");
    const aliasPart = pipe >= 0 ? inner.slice(pipe) : "";
    const beforeAlias = pipe >= 0 ? inner.slice(0, pipe) : inner;
    const hash = beforeAlias.indexOf("#");
    const targetPart = hash >= 0 ? beforeAlias.slice(0, hash) : beforeAlias;
    const trailing = hash >= 0 ? beforeAlias.slice(hash) : "";

    const trimmed = targetPart.trim();
    if (resolveLink(trimmed, allFiles) !== movedPath) return full;

    replaced++;
    return `[[${newStem}${trailing}${aliasPart}]]`;
  });
  return { body: out, replaced };
}
