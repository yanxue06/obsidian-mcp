import { z } from "zod";
import { defineTool } from "./types.js";

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

export const runCommandTool = defineTool({
  name: "run_command",
  title: "Run an Obsidian command",
  description:
    "Execute an Obsidian command by id (e.g. 'editor:toggle-bold', 'app:reload', 'graph:open'). Discover ids with `list_commands`. This is powerful — it lets the agent trigger any plugin action — so use only commands the user has approved.",
  inputSchema: z.object({
    id: z.string().describe("Command id, e.g. 'workspace:close'."),
  }),
  async handler({ id }, { client }) {
    await client.runCommand(id);
    return { ok: true, id };
  },
});

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
