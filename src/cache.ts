/**
 * In-memory cache for the vault file list.
 *
 * `listVault` is the most-called endpoint (every link resolution and graph
 * walk needs the canonical file list). We cache it for a short TTL so chains
 * of agent tool calls don't hammer Obsidian.
 */
import type { ObsidianClient } from "./obsidian.js";

const TTL_MS = 30_000;

let cached: { at: number; files: string[] } | null = null;

export async function getAllFiles(c: ObsidianClient): Promise<string[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.files;
  const files = await c.listVault();
  cached = { at: now, files };
  return files;
}

export function invalidateFileCache(): void {
  cached = null;
}
