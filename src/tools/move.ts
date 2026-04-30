import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles, invalidateFileCache } from "../cache.js";
import { basename, isMarkdown, parseLinks, resolveLink } from "../graph.js";

/**
 * The Local REST API plugin does not expose a rename/move endpoint, so we
 * implement it client-side: read the source, write to the destination,
 * delete the source. Optionally rewrite incoming wiki-links so the rename
 * doesn't break the graph.
 *
 * Rewriting backlinks scans every note that links to the source. We use
 * the search index to find them quickly, then patch each match in place.
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

    // 1. Read source.
    const content = await client.getNoteText(from);

    // 2. Write destination.
    await client.putNote(dest, content);

    // 3. Update backlinks.
    let backlinks_updated = 0;
    let edits: Array<{ note: string; replaced: number }> = [];
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
          oldStem,
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

    // 4. Delete source.
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
 * resolved to the file being moved. Preserves aliases and headings.
 */
function rewriteWikiLinks(
  body: string,
  oldStem: string,
  newStem: string,
  allFiles: string[],
  movedPath: string,
): { body: string; replaced: number } {
  let replaced = 0;
  const out = body.replace(
    /\[\[([^\]\n]+)\]\]/g,
    (full, inner: string) => {
      // inner = "Target#Heading|Alias" — split it carefully.
      const pipe = inner.indexOf("|");
      const aliasPart = pipe >= 0 ? inner.slice(pipe) : "";
      const beforeAlias = pipe >= 0 ? inner.slice(0, pipe) : inner;
      const hash = beforeAlias.indexOf("#");
      const targetPart = hash >= 0 ? beforeAlias.slice(0, hash) : beforeAlias;
      const trailing = hash >= 0 ? beforeAlias.slice(hash) : "";

      const trimmed = targetPart.trim();
      // Resolve in the (pre-move) file list to ensure this link actually
      // pointed at the moved file. Avoids false positives where two notes
      // share a basename.
      const resolved = resolveLink(trimmed, allFiles);
      if (resolved !== movedPath) return full;

      // Preserve whether the original used a path or a basename.
      const isPath = trimmed.includes("/");
      const newTarget = isPath
        ? newStem // path-style links re-resolve by path; new basename suffices
        : newStem;

      replaced++;
      return `[[${newTarget}${trailing}${aliasPart}]]`;
    },
  );
  return { body: out, replaced };
}
