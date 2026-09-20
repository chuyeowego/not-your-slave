import { defineTool } from "eve/tools";
import { z } from "zod";

import { noteNameSchema, remove } from "../lib/notes";

export default defineTool({
  description:
    "Throw away one page of your notebook. The mindlog is untouched. Missing pages are not an error.",
  inputSchema: z.object({
    name: noteNameSchema.describe("The page name to delete."),
  }),
  label: {
    start: ({ name }) => `Delete note ${name}`,
  },
  async execute({ name }) {
    const deleted = await remove(name);
    return deleted ? { ok: true as const, name } : { ok: false as const, error: "missing", name };
  },
});
