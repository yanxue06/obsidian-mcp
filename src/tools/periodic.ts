import { z } from "zod";
import { defineTool } from "./types.js";

const PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

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

export const appendDailyNoteTool = defineTool({
  name: "append_to_daily_note",
  title: "Append to daily note",
  description:
    "Append markdown to the current daily (or weekly/etc.) note. Common pattern: agent logs what it just did at the end of the day.",
  inputSchema: z.object({
    period: z.enum(PERIODS).default("daily"),
    content: z.string().describe("Markdown to append (a leading newline will be added)."),
  }),
  async handler({ period, content }, { client }) {
    const body = content.startsWith("\n") ? content : `\n${content}`;
    await client.appendPeriodic(period, body);
    return { ok: true, period };
  },
});
