import { z } from "zod";
import { defineTool } from "./types.js";
import { parseHeadings } from "../graph.js";

export const getOutlineTool = defineTool({
  name: "get_outline",
  title: "Get a note's heading outline",
  description:
    "Return the heading structure of a note (level + text + line number). Use this instead of `get_note` when you only need to navigate to a section of a long note — it's much smaller in tokens.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path."),
  }),
  async handler({ path }, { client }) {
    const text = await client.getNoteText(path);
    const headings = parseHeadings(text);
    return {
      path,
      heading_count: headings.length,
      headings,
    };
  },
});
