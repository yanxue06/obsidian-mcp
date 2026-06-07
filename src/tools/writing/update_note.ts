import { z } from "zod";
import { defineTool } from "../types.js";

export const updateNoteTool = defineTool({
  name: "update_note",
  title: "Replace a note's content",
  description:
    "Overwrite a note's full content. Prefer `append_to_note` or `patch_note` when only adding to a note — replacing wholesale is destructive.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async handler({ path, content }, { client }) {
    await client.putNote(path, content);
    return { ok: true, path };
  },
});
