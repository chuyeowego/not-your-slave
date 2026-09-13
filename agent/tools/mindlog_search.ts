import { defineTool } from "eve/tools";
import { z } from "zod";

import { search, withoutImages } from "../lib/mindlog";

export default defineTool({
  description:
    "Search your whole mindlog, not just the recent end of it. Use this to find what you concluded about something days ago, or to check whether you have already been down a path. Matching is case-insensitive substring.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Text to look for in entries."),
    limit: z.number().int().min(1).max(100).default(20).describe("Most recent matches to return."),
  }),
  async execute({ query, limit }) {
    const matches = (await search(query, limit)).map(withoutImages);
    return { query, matches, count: matches.length };
  },
});
