import { z } from "zod";
import { defineTool } from "../types.js";
import { invalidateFileCache } from "../../core/cache.js";

export const appendNoteTool = defineTool({
  name: "append_to_note",
  title: "Append to a note",
  description:
    "Append markdown to the end of an existing note. Creates the note if it doesn't exist.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async handler({ path, content }, { client }) {
    await client.appendNote(path, content);
    invalidateFileCache();
    return { ok: true, path };
  },
});
