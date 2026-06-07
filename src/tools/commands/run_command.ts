import { z } from "zod";
import { defineTool } from "../types.js";

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
