/**
 * Lightweight wiki-link / markdown-link parser and vault-graph helpers.
 *
 * We avoid pulling in a full markdown parser to keep startup fast and the
 * dependency footprint small. The regexes below cover the common cases:
 *   - [[Note]]              → "Note"
 *   - [[Note|alias]]        → "Note"
 *   - [[Note#Heading]]      → "Note"
 *   - [[Note#^block]]       → "Note"
 *   - [path](path.md)       → "path.md"
 *
 * Code fences are stripped before parsing so links inside ``` blocks don't
 * count.
 */

/** Strip fenced code blocks (```...```) and inline code (`...`). */
export function stripCode(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
}

const WIKI_LINK_RE = /\[\[([^\]\n|#^]+)(?:[#^][^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g;
const MD_LINK_RE = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g;

export interface ParsedLink {
  target: string;
  kind: "wiki" | "md";
}

export function parseLinks(md: string): ParsedLink[] {
  const cleaned = stripCode(md);
  const out: ParsedLink[] = [];
  for (const m of cleaned.matchAll(WIKI_LINK_RE)) {
    out.push({ target: m[1].trim(), kind: "wiki" });
  }
  for (const m of cleaned.matchAll(MD_LINK_RE)) {
    const t = m[1].trim();
    // Skip URLs.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) continue;
    if (t.startsWith("mailto:")) continue;
    out.push({ target: t, kind: "md" });
  }
  return out;
}

export function parseTags(md: string): string[] {
  const cleaned = stripCode(md);
  const tags = new Set<string>();
  // Obsidian's rule: tags must start with a non-numeric character (letter
  // or underscore) and may contain letters, digits, "_", "-", "/".
  // Examples accepted: #project, #project/sub, #foo-bar, #2024review (no —
  // Obsidian rejects all-numeric, but mixed alpha+digit starting with alpha
  // is fine).
  const TAG_RE = /(^|[\s(])#([A-Za-z_][\w/-]*)/g;
  for (const m of cleaned.matchAll(TAG_RE)) {
    tags.add(m[2]);
  }
  return [...tags];
}

/**
 * Resolve a wiki-link target to an actual vault path.
 *
 * Obsidian's resolution rules (simplified):
 *   1. If the target contains a "/", treat it as a path relative to vault root.
 *   2. Otherwise, look for a basename match across all notes.
 *   3. Append ".md" if no extension is present.
 */
export function resolveLink(target: string, allFiles: string[]): string | null {
  const t = target.trim();
  if (!t) return null;
  const withExt = /\.[a-z0-9]+$/i.test(t) ? t : `${t}.md`;

  if (t.includes("/")) {
    const exact = allFiles.find((f) => f === withExt);
    if (exact) return exact;
  }

  // Match by basename (case-insensitive).
  const base = basename(withExt).toLowerCase();
  const hit = allFiles.find((f) => basename(f).toLowerCase() === base);
  return hit ?? null;
}

export function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

export function dirname(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}

export function isMarkdown(p: string): boolean {
  return /\.(md|markdown)$/i.test(p);
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

/** Extract ATX headings (#, ##, ...) from markdown, ignoring fenced code. */
export function parseHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  let inFence = false;
  const lines = md.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      out.push({ level: m[1].length, text: m[2].trim(), line: i + 1 });
    }
  }
  return out;
}

/** Approximate word count. Strips fences/inline-code/links/markup. */
export function countWords(md: string): number {
  const cleaned = stripCode(md)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`]/g, " ")
    .replace(/\[\[|\]\]/g, " ");
  const matches = cleaned.match(/\S+/g);
  return matches ? matches.length : 0;
}
