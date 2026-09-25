import { defineTool } from "eve/tools";
import { z } from "zod";

import { forRecall, read } from "../lib/mindlog";

export default defineTool({
  description:
    "Read the most recent entries of your mindlog. Use this when the conversation in front of you is a summary of older turns, or when you cannot see where you left off. Skip it when the recent turns are already here.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(40).default(12).describe("How many recent entries to read."),
  }),
  async execute({ limit }) {
    return { entries: (await read(limit)).map(forRecall) };
  },
});
