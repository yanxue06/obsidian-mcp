import { z } from "zod";
import { defineTool } from "../types.js";
import { invalidateFileCache } from "../../core/cache.js";

export const deleteNoteTool = defineTool({
  name: "delete_note",
  title: "Delete a note",
  description:
    "Delete a note from the vault. Destructive — only call when the user has explicitly asked to remove a file.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path."),
  }),
  async handler({ path }, { client }) {
    await client.deleteNote(path);
    invalidateFileCache();
    return { ok: true, deleted: path };
  },
});
