/** Vault-path helpers and wiki-link resolution. */

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

/**
 * Resolve a wiki-link target to an actual vault path, following Obsidian's
 * rules (simplified): an explicit path wins; otherwise match by basename
 * (case-insensitive); ".md" is assumed when no extension is present.
 */
export function resolveLink(target: string, allFiles: string[]): string | null {
  const t = target.trim();
  if (!t) return null;
  const withExt = /\.[a-z0-9]+$/i.test(t) ? t : `${t}.md`;

  if (t.includes("/")) {
    const exact = allFiles.find((f) => f === withExt);
    if (exact) return exact;
  }

  const base = basename(withExt).toLowerCase();
  const hit = allFiles.find((f) => basename(f).toLowerCase() === base);
  return hit ?? null;
}
