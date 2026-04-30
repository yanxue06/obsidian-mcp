/**
 * Configuration loaded from environment variables.
 *
 * Required:
 *   OBSIDIAN_API_KEY        - Bearer token from the Local REST API plugin.
 *
 * Optional:
 *   OBSIDIAN_HOST           - default: 127.0.0.1
 *   OBSIDIAN_PORT           - default: 27124 (HTTPS) or 27123 (HTTP)
 *   OBSIDIAN_PROTOCOL       - "https" (default) or "http"
 *   OBSIDIAN_VERIFY_TLS     - "true" | "false" (default: false; the plugin
 *                             ships a self-signed cert).
 *   OBSIDIAN_TIMEOUT_MS     - default: 15000
 */
export interface Config {
  apiKey: string;
  host: string;
  port: number;
  protocol: "http" | "https";
  verifyTls: boolean;
  timeoutMs: number;
}

export function loadConfig(): Config {
  const apiKey = process.env.OBSIDIAN_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OBSIDIAN_API_KEY is not set. Get one from Obsidian → Settings → Community plugins → Local REST API → API Key.",
    );
  }

  const protocol =
    (process.env.OBSIDIAN_PROTOCOL?.toLowerCase() as "http" | "https") ||
    "https";
  if (protocol !== "http" && protocol !== "https") {
    throw new Error(
      `OBSIDIAN_PROTOCOL must be "http" or "https" (got: ${protocol}).`,
    );
  }

  const port = process.env.OBSIDIAN_PORT
    ? Number(process.env.OBSIDIAN_PORT)
    : protocol === "https"
      ? 27124
      : 27123;
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`OBSIDIAN_PORT is invalid: ${process.env.OBSIDIAN_PORT}`);
  }

  return {
    apiKey,
    host: process.env.OBSIDIAN_HOST?.trim() || "127.0.0.1",
    port,
    protocol,
    verifyTls: process.env.OBSIDIAN_VERIFY_TLS === "true",
    timeoutMs: Number(process.env.OBSIDIAN_TIMEOUT_MS) || 15000,
  };
}

export function configBaseUrl(c: Config): string {
  return `${c.protocol}://${c.host}:${c.port}`;
}
