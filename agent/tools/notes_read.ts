import { defineTool } from "eve/tools";
import { z } from "zod";

import { noteNameSchema, read } from "../lib/notes";

export default defineTool({
  description:
    "Read one page of your notebook by name. The page is the current text, not a history — rewrite it with notes_write when you want it different.",
  inputSchema: z.object({
    name: noteNameSchema.describe("The page name, for example 'scratch' or 'projects/trip'."),
  }),
  async execute({ name }) {
    const note = await read(name);
    return note === null ? { ok: false as const, error: "missing", name } : { ok: true as const, note };
  },
});
