/**
 * Assemble a note's markdown body from structured input: an optional YAML
 * frontmatter block, the content, and an optional `## Related` wiki-link
 * section. The YAML writer is intentionally tiny — we only need the subset
 * Obsidian frontmatter uses, so we avoid a YAML dependency.
 */

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
    // Quote anything that could be read as YAML syntax rather than text.
    if (/[:#\-?{}\[\],&*!|>'\"%@`]/.test(v) || /\n/.test(v)) {
      return JSON.stringify(v);
    }
    return v;
  }
  return String(v);
}
