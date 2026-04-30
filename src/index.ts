#!/usr/bin/env node
/**
 * obsidian-mcp — MCP server that gives Claude (and any MCP client)
 * graph-aware access to an Obsidian vault.
 *
 * Transport: stdio (the standard for local MCP servers).
 * Server SDK: @modelcontextprotocol/sdk's high-level McpServer, which accepts
 * Zod schemas directly and handles JSON-Schema generation for us.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadConfig } from "./config.js";
import { ObsidianClient, ObsidianError } from "./obsidian.js";
import { allTools } from "./tools/index.js";

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    // Print to stderr — stdout is reserved for the MCP protocol.
    console.error(`[obsidian-mcp] ${(err as Error).message}`);
    process.exit(1);
  }

  const client = new ObsidianClient(config);

  const server = new McpServer(
    {
      name: "obsidian-mcp",
      version: getVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title ?? tool.name,
        description: tool.description,
        // McpServer accepts a ZodRawShape; it builds the object schema and
        // emits JSON Schema for clients internally.
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

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Surface a one-line readiness check on stderr (MCP clients typically
  // log stderr but never read from it).
  console.error(
    `[obsidian-mcp] connected to Obsidian at ${config.protocol}://${config.host}:${config.port} (${allTools.length} tools)`,
  );
}

function getVersion(): string {
  // Read at build time from package.json by way of the bundler? We're not
  // bundling; just hardcode and bump in package.json + here together.
  return "0.1.0";
}

main().catch((err) => {
  console.error("[obsidian-mcp] fatal:", err);
  process.exit(1);
});
