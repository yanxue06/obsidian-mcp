/**
 * Short-TTL cache of the vault's file list.
 *
 * `listVault` backs every link resolution and graph walk, so a chain of agent
 * tool calls would otherwise hammer Obsidian for the same listing. Writes
 * invalidate the cache so freshly created/moved/deleted notes show up.
 */
import type { ObsidianClient } from "../client/obsidian.js";

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
