import { defineTool } from "eve/tools";
import { z } from "zod";

import { read, withoutImages } from "../lib/mindlog";

export default defineTool({
  description:
    "Read the most recent entries of your mindlog. This is how you remember what you were doing, thinking, and waiting on before this moment. Call it whenever you wake up with no context.",
  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).default(40).describe("How many recent entries to read."),
  }),
  async execute({ limit }) {
    return { entries: (await read(limit)).map(withoutImages) };
  },
});
