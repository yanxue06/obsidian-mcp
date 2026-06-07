import { z } from "zod";
import { defineTool } from "../types.js";

export const listCommandsTool = defineTool({
  name: "list_commands",
  title: "List Obsidian commands",
  description:
    "List every registered Obsidian command (built-in + plugin) with its id and human name. Use this before `run_command` to discover what's available — vaults differ based on installed plugins.",
  inputSchema: z.object({
    filter: z
      .string()
      .optional()
      .describe("Substring filter against name or id (case-insensitive)."),
    limit: z.number().int().positive().max(500).default(200),
  }),
  async handler({ filter, limit }, { client }) {
    const cmds = await client.listCommands();
    const f = filter?.toLowerCase();
    const filtered = (
      f
        ? cmds.filter(
            (c) =>
              c.id.toLowerCase().includes(f) || c.name.toLowerCase().includes(f),
          )
        : cmds
    ).slice(0, limit);
    return { count: filtered.length, total: cmds.length, commands: filtered };
  },
});
