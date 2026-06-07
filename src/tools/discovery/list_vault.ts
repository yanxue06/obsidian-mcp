import { z } from "zod";
import { defineTool } from "../types.js";
import { getAllFiles } from "../../core/cache.js";
import { isMarkdown } from "../../core/paths.js";

export const listVaultTool = defineTool({
  name: "list_vault",
  title: "List vault files",
  description:
    "List all files in the Obsidian vault. Use `folder` to scope to a subdirectory and `markdown_only` to filter to notes. Prefer this over guessing paths.",
  inputSchema: z.object({
    folder: z
      .string()
      .optional()
      .describe("Vault-relative folder path. Empty = vault root."),
    markdown_only: z
      .boolean()
      .default(true)
      .describe("If true, only return .md / .markdown files."),
    limit: z
      .number()
      .int()
      .positive()
      .max(2000)
      .default(500)
      .describe("Max number of paths to return."),
  }),
  async handler({ folder, markdown_only, limit }, { client }) {
    const all = folder
      ? await client.listFolder(folder)
      : await getAllFiles(client);
    const files = (all ?? [])
      .map((f) => (folder ? `${folder.replace(/\/+$/g, "")}/${f}` : f))
      .filter((f) => (markdown_only ? isMarkdown(f) : true))
      .slice(0, limit);
    return { count: files.length, files };
  },
});
