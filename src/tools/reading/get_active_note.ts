import { z } from "zod";
import { defineTool } from "../types.js";

export const getActiveNoteTool = defineTool({
  name: "get_active_note",
  title: "Get currently open note",
  description:
    "Return the note the user currently has focused in Obsidian. Useful for 'what am I looking at' style prompts.",
  inputSchema: z.object({}),
  async handler(_input, { client }) {
    return await client.getActive();
  },
});
