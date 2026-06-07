import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles, invalidateFileCache } from "../../core/cache.js";
import { isMarkdown } from "../../core/paths.js";
import { buildNoteBody } from "../../core/note-body.js";
import { noteWriteSchema } from "./shared.js";

export const createNotesTool = defineTool({
  name: "create_notes",
  title: "Create multiple notes in one call",
  description:
    "Create many notes in a single tool call. Designed for bootstrapping a knowledge graph (MOC + topical notes) without paying N round-trips. Each entry follows the same schema as `create_note`. Per-note errors are reported individually; pass `stop_on_error: true` to abort on the first failure. Within a batch, later entries also fail if they target a path already created earlier in the same call.",
  inputSchema: z.object({
    notes: z
      .array(noteWriteSchema)
      .min(1)
      .describe("Notes to create. Each entry has the same fields as create_note."),
    stop_on_error: z
      .boolean()
      .default(false)
      .describe(
        "Abort the batch on the first failure. Default: continue and report per-note results.",
      ),
  }),
  async handler({ notes, stop_on_error }, { client }) {
    const results: Array<{
      path: string;
      ok: boolean;
      bytes?: number;
      error?: string;
    }> = [];

    // Pre-fetch the vault listing once for the whole batch (instead of one
    // existence check per note). Copy it so within-batch creations can be
    // tracked without mutating the shared cache.
    const seenFiles = notes.some((n) => !n.overwrite)
      ? [...(await getAllFiles(client))]
      : [];

    for (const note of notes) {
      const finalPath = isMarkdown(note.path) ? note.path : `${note.path}.md`;
      try {
        if (!note.overwrite && seenFiles.includes(finalPath)) {
          throw new Error(
            `Note already exists: ${finalPath}. Pass overwrite:true to replace.`,
          );
        }
        const body = buildNoteBody({
          content: note.content,
          frontmatter: note.frontmatter,
          links: note.links,
        });
        await client.putNote(finalPath, body);
        results.push({
          path: finalPath,
          ok: true,
          bytes: Buffer.byteLength(body),
        });
        seenFiles.push(finalPath);
      } catch (err) {
        results.push({
          path: finalPath,
          ok: false,
          error: (err as Error).message,
        });
        if (stop_on_error) break;
      }
    }

    invalidateFileCache();
    return {
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  },
});
