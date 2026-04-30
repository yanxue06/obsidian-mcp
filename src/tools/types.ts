import { z, type ZodRawShape } from "zod";
import type { ObsidianClient } from "../obsidian.js";

export interface ToolContext {
  client: ObsidianClient;
}

/**
 * Internal tool descriptor. We keep schemas as Zod object schemas (so we
 * can call `.shape` for the MCP SDK) and infer handler input types from
 * them at compile time.
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
 * Type-erased tool. Used in arrays so a heterogeneous list of tools with
 * different input shapes can live in a single export without TypeScript
 * complaining about handler variance.
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
