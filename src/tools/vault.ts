import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles, invalidateFileCache } from "../cache.js";
import { isMarkdown } from "../graph.js";

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
