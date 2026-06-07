/**
 * Builds the MCP server: wraps an ObsidianClient and registers every tool from
 * the registry. Each tool's handler runs inside a uniform try/catch that turns
 * thrown errors (including ObsidianError detail) into MCP error results.
 */
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { Config } from "./client/config.js";
import { ObsidianClient, ObsidianError } from "./client/obsidian.js";
import { allTools } from "./tools/index.js";

export function createServer(config: Config): McpServer {
  const client = new ObsidianClient(config);

  const server = new McpServer(
    { name: "obsidian-mcp", version: getVersion() },
    { capabilities: { tools: {} } },
  );

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title ?? tool.name,
        description: tool.description,
        // McpServer accepts a ZodRawShape and emits JSON Schema for clients.
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        try {
          const result = await tool.handler(args, { client });
          return {
            content: [
              {
                type: "text",
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          const e = err as Error;
          const detail =
            err instanceof ObsidianError && err.body !== undefined
              ? `\n${JSON.stringify(err.body, null, 2)}`
              : "";
          return {
            isError: true,
            content: [{ type: "text", text: `${e.message}${detail}` }],
          };
        }
      },
    );
  }

  return server;
}

/** Read the version from package.json so it has a single source of truth. */
export function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
