import { z } from "zod";
import { defineTool } from "../types.js";

export const queryDataviewTool = defineTool({
  name: "query_dataview",
  title: "Run a Dataview DQL query",
  description:
    "Run a Dataview DQL query (LIST / TABLE / TASK) against the vault. Requires the Dataview plugin installed in the vault. Powerful for structured questions like 'all notes tagged #project where status != done sorted by due date'.",
  inputSchema: z.object({
    dql: z
      .string()
      .describe(
        "A Dataview DQL query string, e.g.\n  TABLE status, due FROM #project WHERE status != \"done\" SORT due ASC",
      ),
  }),
  async handler({ dql }, { client }) {
    const rows = await client.dataview(dql);
    return { count: rows.length, rows };
  },
});
