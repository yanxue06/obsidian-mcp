#!/usr/bin/env node
/**
 * obsidian-mcp — an MCP server that gives Claude (and any MCP client)
 * graph-aware access to an Obsidian vault, over stdio.
 *
 * This file is just the entry point: load config, build the server, connect
 * the transport. The wiring lives in server.ts; the tools in tools/.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./client/config.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // stdout is reserved for the MCP protocol, so diagnostics go to stderr.
    console.error(`[obsidian-mcp] ${(err as Error).message}`);
    process.exit(1);
  }

  const server = createServer(config);
  await server.connect(new StdioServerTransport());

  console.error(
    `[obsidian-mcp] connected to Obsidian at ${config.protocol}://${config.host}:${config.port}`,
  );
}

main().catch((err) => {
  console.error("[obsidian-mcp] fatal:", err);
  process.exit(1);
});
