/**
 * Markdown parsing for Obsidian notes — links, tags, headings, word counts.
 *
 * We avoid a full markdown parser to keep startup fast and the dependency
 * footprint small; the regexes below cover the cases Obsidian itself supports.
 * Fenced and inline code is stripped first so links/tags inside it don't count.
 */

/** Strip fenced code blocks (```...```) and inline code (`...`). */
export function stripCode(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
}

export interface ParsedLink {
  target: string;
  kind: "wiki" | "md";
}

// [[Note]], [[Note|alias]], [[Note#Heading]], [[Note#^block]] → "Note"
const WIKI_LINK_RE = /\[\[([^\]\n|#^]+)(?:[#^][^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g;
// [text](path.md) → "path.md"
const MD_LINK_RE = /\[[^\]\n]*\]\(([^)\s#]+)(?:#[^)\s]*)?\)/g;

export function parseLinks(md: string): ParsedLink[] {
  const cleaned = stripCode(md);
  const out: ParsedLink[] = [];
  for (const m of cleaned.matchAll(WIKI_LINK_RE)) {
    out.push({ target: m[1].trim(), kind: "wiki" });
  }
  for (const m of cleaned.matchAll(MD_LINK_RE)) {
    const t = m[1].trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) continue; // skip URLs
    if (t.startsWith("mailto:")) continue;
    out.push({ target: t, kind: "md" });
  }
  return out;
}

export function parseTags(md: string): string[] {
  const cleaned = stripCode(md);
  const tags = new Set<string>();
  // Obsidian requires a tag to start with a letter or underscore (so #123 is
  // not a tag) and allows letters, digits, "_", "-", "/" thereafter.
  const TAG_RE = /(^|[\s(])#([A-Za-z_][\w/-]*)/g;
  for (const m of cleaned.matchAll(TAG_RE)) {
    tags.add(m[2]);
  }
  return [...tags];
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

/** Extract ATX headings (#, ##, ...), ignoring fenced code. */
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

/** Approximate word count, with markup and code stripped out. */
export function countWords(md: string): number {
  const cleaned = stripCode(md)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`]/g, " ")
    .replace(/\[\[|\]\]/g, " ");
  const matches = cleaned.match(/\S+/g);
  return matches ? matches.length : 0;
}
