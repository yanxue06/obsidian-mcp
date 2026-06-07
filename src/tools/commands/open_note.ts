import { z } from "zod";
import { defineTool } from "../types.js";

export const openNoteTool = defineTool({
  name: "open_note",
  title: "Open a note in Obsidian's UI",
  description:
    "Surface a note in Obsidian's workspace (focuses an existing tab or opens a new one). Great for ending an agent task with 'and here's the result for you to review'.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path."),
    new_leaf: z
      .boolean()
      .default(false)
      .describe("If true, open in a new tab instead of replacing the current one."),
  }),
  async handler({ path, new_leaf }, { client }) {
    await client.openNote(path, { newLeaf: new_leaf });
    return { ok: true, opened: path, new_leaf };
  },
});
