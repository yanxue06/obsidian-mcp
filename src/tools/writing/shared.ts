import { z } from "zod";

/**
 * Schema shared by create_note and create_notes — a write that produces a
 * fresh body from frontmatter + content + an optional links section.
 */
export const noteWriteSchema = z.object({
  path: z
    .string()
    .describe("Vault-relative path. '.md' is appended if missing."),
  content: z.string().default("").describe("Markdown body."),
  frontmatter: z
    .record(z.unknown())
    .optional()
    .describe("YAML frontmatter as a JSON object."),
  links: z
    .array(z.string())
    .optional()
    .describe(
      "Optional list of note titles to render as `[[wiki-links]]` at the end.",
    ),
  overwrite: z.boolean().default(false),
});
