import { z } from "zod";
import { defineTool } from "../types.js";
import { PERIODS } from "../../client/obsidian.js";

export const getDailyNoteTool = defineTool({
  name: "get_daily_note",
  title: "Get daily / periodic note",
  description:
    "Fetch the user's current daily (or weekly/monthly/etc.) note. Returns content + frontmatter + tags. Requires the Periodic Notes or Daily Notes plugin in the vault.",
  inputSchema: z.object({
    period: z
      .enum(PERIODS)
      .default("daily")
      .describe("Which periodic note to fetch."),
  }),
  async handler({ period }, { client }) {
    return await client.getPeriodic(period);
  },
});
