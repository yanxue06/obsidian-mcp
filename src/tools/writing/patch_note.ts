import { z } from "zod";
import { defineTool } from "../types.js";

export const patchNoteTool = defineTool({
  name: "patch_note",
  title: "Insert content at a heading or block",
  description:
    "Insert content relative to a heading, block reference, or frontmatter field — without rewriting the whole note. Example: append a bullet under '## Tasks' without touching the rest of the page.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
    operation: z
      .enum(["append", "prepend", "replace"])
      .describe("How to insert relative to the target."),
    target_type: z
      .enum(["heading", "block", "frontmatter"])
      .describe("What kind of anchor `target` refers to."),
    target: z
      .string()
      .describe(
        "Heading text (e.g. 'Tasks'), block id (e.g. 'block-id'), or frontmatter key (e.g. 'tags').",
      ),
  }),
  async handler({ path, content, operation, target_type, target }, { client }) {
    await client.patchNote(path, content, {
      operation,
      targetType: target_type,
      target,
    });
    return { ok: true, path };
  },
});
