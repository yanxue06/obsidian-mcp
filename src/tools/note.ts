import { z } from "zod";
import { defineTool } from "./types.js";
import { getAllFiles, invalidateFileCache } from "../cache.js";
import {
  basename,
  isMarkdown,
  parseLinks,
  parseTags,
  resolveLink,
} from "../graph.js";

/**
 * The flagship "get_note" tool. Other Obsidian MCP servers return just file
 * contents — we additionally compute backlinks, forward links, and tags so
 * the LLM doesn't have to make N follow-up calls to understand a note's
 * place in the graph.
 */
export const getNoteTool = defineTool({
  name: "get_note",
  title: "Get note with graph context",
  description:
    "Get a note's content plus its graph context: backlinks (who links to it), forward links (who it links to), tags, and frontmatter. Use the `include` array to control which context is fetched — backlinks are O(vault size) so omit them when unneeded.",
  inputSchema: z.object({
    path: z.string().describe("Vault-relative path to the note."),
    include: z
      .array(
        z.enum(["backlinks", "forward_links", "tags", "frontmatter", "content"]),
      )
      .default(["content", "forward_links", "tags", "frontmatter"])
      .describe(
        "Which fields to populate. Backlinks are expensive on large vaults.",
      ),
    backlinks_limit: z.number().int().positive().max(500).default(50),
  }),
  async handler({ path, include, backlinks_limit }, { client }) {
    const want = new Set(include);

    const note = await client.getNote(path);
    const out: {
      path: string;
      content?: string;
      tags?: string[];
      frontmatter?: Record<string, unknown>;
      forward_links?: Array<{ target: string; resolved: string | null }>;
      backlinks?: Array<{ source: string; snippet?: string }>;
    } = { path: note.path };

    if (want.has("content")) out.content = note.content;
    if (want.has("frontmatter")) out.frontmatter = note.frontmatter ?? {};
    if (want.has("tags")) {
      const fromBody = parseTags(note.content ?? "");
      const fromMeta = note.tags ?? [];
      out.tags = [...new Set([...fromMeta, ...fromBody])];
    }

    if (want.has("forward_links")) {
      const all = await getAllFiles(client);
      const links = parseLinks(note.content ?? "");
      out.forward_links = links.map((l) => ({
        target: l.target,
        resolved: resolveLink(l.target, all),
      }));
    }

    if (want.has("backlinks")) {
      const all = await getAllFiles(client);
      const target = basename(note.path).replace(/\.md$/i, "");
      // Plain-text scan covers wiki-links by basename or path. Falls back to
      // the simple search endpoint, which is indexed.
      void all;
      const hits = await client.simpleSearch(`[[${target}`, 80);
      out.backlinks = hits
        .filter((h) => h.filename !== note.path)
        .slice(0, backlinks_limit)
        .map((h) => ({
          source: h.filename,
          snippet: h.matches?.[0]?.context,
        }));
    }

    return out;
  },
});

// Shared schema for create_note / create_notes / upsert_note (writes that
// produce a fresh body from frontmatter + content + optional links section).
const noteWriteSchema = z.object({
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

export const createNoteTool = defineTool({
  name: "create_note",
  title: "Create a note",
  description:
    "Create a new note (fails if it already exists unless `overwrite` is true). Frontmatter is rendered as YAML. Use `links` to append a wiki-link section at the end. For creating many notes in one call, use `create_notes`. For idempotent create-or-update writes, use `upsert_note`.",
  inputSchema: noteWriteSchema,
  async handler(
    { path, content, frontmatter, links, overwrite },
    { client },
  ) {
    const finalPath = isMarkdown(path) ? path : `${path}.md`;

    if (!overwrite) {
      const all = await getAllFiles(client);
      if (all.includes(finalPath)) {
        throw new Error(
          `Note already exists: ${finalPath}. Pass overwrite:true to replace.`,
        );
      }
    }

    const body = buildNoteBody({ content, frontmatter, links });
    await client.putNote(finalPath, body);
    invalidateFileCache();
    return { ok: true, path: finalPath, bytes: Buffer.byteLength(body) };
  },
});

export const createNotesTool = defineTool({
  name: "create_notes",
  title: "Create multiple notes in one call",
  description:
    "Create many notes in a single tool call. Designed for bootstrapping a knowledge graph (MOC + topical notes) without paying N round-trips. Each entry follows the same schema as `create_note`. Per-note errors are reported individually; pass `stop_on_error: true` to abort on the first failure. Within a batch, later entries also fail if they target a path already created earlier in the same call.",
  inputSchema: z.object({
    notes: z
      .array(noteWriteSchema)
      .min(1)
      .describe("Notes to create. Each entry has the same fields as create_note."),
    stop_on_error: z
      .boolean()
      .default(false)
      .describe(
        "Abort the batch on the first failure. Default: continue and report per-note results.",
      ),
  }),
  async handler({ notes, stop_on_error }, { client }) {
    const results: Array<{
      path: string;
      ok: boolean;
      bytes?: number;
      error?: string;
    }> = [];

    // Pre-fetch the vault listing once for the whole batch. Without this, a
    // create_notes call with N entries would do N existence-check round-trips.
    // Copy the cached array so we can append within-batch creations without
    // mutating the shared cache.
    const seenFiles = notes.some((n) => !n.overwrite)
      ? [...(await getAllFiles(client))]
      : [];

    for (const note of notes) {
      const finalPath = isMarkdown(note.path) ? note.path : `${note.path}.md`;
      try {
        if (!note.overwrite && seenFiles.includes(finalPath)) {
          throw new Error(
            `Note already exists: ${finalPath}. Pass overwrite:true to replace.`,
          );
        }
        const body = buildNoteBody({
          content: note.content,
          frontmatter: note.frontmatter,
          links: note.links,
        });
        await client.putNote(finalPath, body);
        results.push({
          path: finalPath,
          ok: true,
          bytes: Buffer.byteLength(body),
        });
        seenFiles.push(finalPath);
      } catch (err) {
        results.push({
          path: finalPath,
          ok: false,
          error: (err as Error).message,
        });
        if (stop_on_error) break;
      }
    }

    invalidateFileCache();
    return {
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  },
});

export const upsertNoteTool = defineTool({
  name: "upsert_note",
  title: "Create or update a note",
  description:
    "Create a note if missing, replace it if it exists. Body is always fully replaced. Frontmatter is replaced by default; pass `merge_frontmatter: true` to keep existing frontmatter keys not specified in this call. Use this when you want an idempotent write — neither `create_note` (errors on existence) nor `update_note` (errors when missing) handle that on their own.",
  inputSchema: z.object({
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
    merge_frontmatter: z
      .boolean()
      .default(false)
      .describe(
        "If true and the note already exists, merge new frontmatter keys on top of existing ones instead of replacing the block wholesale. Body is always replaced.",
      ),
  }),
  async handler(
    { path, content, frontmatter, links, merge_frontmatter },
    { client },
  ) {
    const finalPath = isMarkdown(path) ? path : `${path}.md`;
    const allFiles = await getAllFiles(client);
    const existed = allFiles.includes(finalPath);

    let effectiveFrontmatter = frontmatter;
    if (existed && merge_frontmatter && frontmatter) {
      try {
        const existing = await client.getNote(finalPath);
        effectiveFrontmatter = {
          ...(existing.frontmatter ?? {}),
          ...frontmatter,
        };
      } catch {
        // If reading the existing frontmatter fails, fall back to the
        // provided frontmatter as-is — the write below still succeeds.
      }
    }

    const body = buildNoteBody({
      content,
      frontmatter: effectiveFrontmatter,
      links,
    });
    await client.putNote(finalPath, body);
    invalidateFileCache();
    return {
      ok: true,
      path: finalPath,
      created: !existed,
      bytes: Buffer.byteLength(body),
    };
  },
});

export const updateNoteTool = defineTool({
  name: "update_note",
  title: "Replace a note's content",
  description:
    "Overwrite a note's full content. Prefer `append_to_note` or `patch_note` when only adding to a note — replacing wholesale is destructive.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async handler({ path, content }, { client }) {
    await client.putNote(path, content);
    return { ok: true, path };
  },
});

export const appendNoteTool = defineTool({
  name: "append_to_note",
  title: "Append to a note",
  description:
    "Append markdown to the end of an existing note. Creates the note if it doesn't exist.",
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  async handler({ path, content }, { client }) {
    await client.appendNote(path, content);
    invalidateFileCache();
    return { ok: true, path };
  },
});

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

// ---------- helpers ----------

export function buildNoteBody(input: {
  content?: string;
  frontmatter?: Record<string, unknown>;
  links?: string[];
}): string {
  let body = "";
  if (input.frontmatter && Object.keys(input.frontmatter).length > 0) {
    body += "---\n" + renderYaml(input.frontmatter) + "---\n\n";
  }
  body += input.content ?? "";
  if (input.links && input.links.length > 0) {
    body += "\n\n## Related\n";
    for (const l of input.links) body += `- [[${l}]]\n`;
  }
  return body;
}

function renderYaml(obj: Record<string, unknown>): string {
  // Keep this dependency-free; we only need a small subset of YAML.
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const value = formatYamlValue(v);
    lines.push(value.startsWith("\n") ? `${k}:${value}` : `${k}: ${value}`);
  }
  return lines.join("\n") + "\n";
}

function formatYamlValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return "\n" + v.map((x) => `  - ${formatYamlScalar(x)}`).join("\n");
  }
  if (typeof v === "object") {
    return JSON.stringify(v);
  }
  return formatYamlScalar(v);
}

function formatYamlScalar(v: unknown): string {
  if (typeof v === "string") {
    if (/[:#\-?{}\[\],&*!|>'\"%@`]/.test(v) || /\n/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}
