import { defineTool } from "eve/tools";
import { z } from "zod";

import { noteBodySchema, noteNameSchema, write } from "../lib/notes";

export default defineTool({
  description:
    "Create or replace one page of your notebook. The whole page is replaced. Use it for anything you want to keep in front of you and rewrite later. Not a substitute for the mindlog.",
  inputSchema: z.object({
    name: noteNameSchema.describe("The page name, for example 'scratch' or 'projects/trip'."),
    body: noteBodySchema.describe("The full text of the page."),
  }),
  async execute({ name, body }) {
    const note = await write(name, body);
    return { ok: true, note };
  },
});
