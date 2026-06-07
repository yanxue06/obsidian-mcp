import { z, type ZodRawShape } from "zod";
import type { ObsidianClient } from "../client/obsidian.js";

export interface ToolContext {
  client: ObsidianClient;
}

/**
 * Internal tool descriptor. Schemas are Zod object schemas (so we can hand
 * `.shape` to the MCP SDK) and handler input types are inferred from them.
 */
export interface ToolDef<TShape extends ZodRawShape = ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputSchema: z.ZodObject<TShape>;
  handler: (
    input: z.infer<z.ZodObject<TShape>>,
    ctx: ToolContext,
  ) => Promise<unknown>;
}

/**
 * Type-erased tool, so a heterogeneous list of tools with different input
 * shapes can live in one array without TypeScript complaining about variance.
 */
export interface AnyToolDef {
  name: string;
  title?: string;
  description: string;
  inputSchema: z.ZodObject<ZodRawShape>;
  handler: (input: unknown, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<TShape extends ZodRawShape>(
  def: ToolDef<TShape>,
): AnyToolDef {
  return def as unknown as AnyToolDef;
}
