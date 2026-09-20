import { defineTool } from "eve/tools";
import { z } from "zod";

import { list } from "../lib/notes";

export default defineTool({
  description:
    "List the pages in your notebook. These are rewritable notes you keep, not the mindlog. There is no required layout — whatever pages you have named.",
  inputSchema: z.object({}),
  label: {
    start: () => "List notes",
  },
  async execute() {
    const notes = await list();
    return { notes, count: notes.length };
  },
});
