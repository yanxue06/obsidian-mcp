import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles, invalidateFileCache } from "../../core/cache.js";
import { isMarkdown } from "../../core/paths.js";
import { buildNoteBody } from "../../core/note-body.js";

export const upsertNoteTool = defineTool({
  name: "upsert_note",
  title: "Create or update a note",
  description:
    "Create a note if missing, replace it if it exists. Body is always fully replaced. Frontmatter is replaced by default; pass `merge_frontmatter: true` to keep existing frontmatter keys not specified in this call. Use this when you want an idempotent write — neither `create_note` (errors on existence) nor `update_note` (errors when missing) handle that on their own.",
  inputSchema: z.object({
    path: z
      .string()
      .describe("Vault-relative path. '.md' is appended if missing."),
    content: z.string().default("").describe("Markdown body."),
    frontmatter: z
      .record(z.unknown())
      .optional()
      .describe("YAML frontmatter as a JSON object."),
    links: z
      .array(z.string())
      .optional()
      .describe(
        "Optional list of note titles to render as `[[wiki-links]]` at the end.",
      ),
    merge_frontmatter: z
      .boolean()
      .default(false)
      .describe(
        "If true and the note already exists, merge new frontmatter keys on top of existing ones instead of replacing the block wholesale. Body is always replaced.",
      ),
  }),
  async handler(
    { path, content, frontmatter, links, merge_frontmatter },
    { client },
  ) {
    const finalPath = isMarkdown(path) ? path : `${path}.md`;
    const allFiles = await getAllFiles(client);
    const existed = allFiles.includes(finalPath);

    let effectiveFrontmatter = frontmatter;
    if (existed && merge_frontmatter && frontmatter) {
      try {
        const existing = await client.getNote(finalPath);
        effectiveFrontmatter = {
          ...(existing.frontmatter ?? {}),
          ...frontmatter,
        };
      } catch {
        // If reading existing frontmatter fails, fall back to what was passed
        // — the write below still succeeds.
      }
    }

    const body = buildNoteBody({
      content,
      frontmatter: effectiveFrontmatter,
      links,
    });
    await client.putNote(finalPath, body);
    invalidateFileCache();
    return {
      ok: true,
      path: finalPath,
      created: !existed,
      bytes: Buffer.byteLength(body),
    };
  },
});
