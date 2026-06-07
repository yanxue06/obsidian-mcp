import { defineTool } from "../types.js";
import { getAllFiles, invalidateFileCache } from "../../core/cache.js";
import { isMarkdown } from "../../core/paths.js";
import { buildNoteBody } from "../../core/note-body.js";
import { noteWriteSchema } from "./shared.js";

export const createNoteTool = defineTool({
  name: "create_note",
  title: "Create a note",
  description:
    "Create a new note (fails if it already exists unless `overwrite` is true). Frontmatter is rendered as YAML. Use `links` to append a wiki-link section at the end. For creating many notes in one call, use `create_notes`. For idempotent create-or-update writes, use `upsert_note`.",
  inputSchema: noteWriteSchema,
  async handler({ path, content, frontmatter, links, overwrite }, { client }) {
    const finalPath = isMarkdown(path) ? path : `${path}.md`;

    if (!overwrite) {
      const all = await getAllFiles(client);
      if (all.includes(finalPath)) {
        throw new Error(
          `Note already exists: ${finalPath}. Pass overwrite:true to replace.`,
        );
      }
    }

    const body = buildNoteBody({ content, frontmatter, links });
    await client.putNote(finalPath, body);
    invalidateFileCache();
    return { ok: true, path: finalPath, bytes: Buffer.byteLength(body) };
  },
});
