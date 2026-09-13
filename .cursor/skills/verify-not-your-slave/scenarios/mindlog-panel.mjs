// Mindlog panel API + page shell; seeds a note when store is empty.
import { writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

import { withPage } from "../lib/cdp.mjs";

export async function run(ctx) {
  const text = `verification probe ${Date.now()}`;
  const id = randomBytes(6).toString("hex");
  const at = new Date().toISOString();
  await writeFile(
    ctx.state.MINDLOG_FILE,
    `${JSON.stringify({ id, at, kind: "note", text })}\n`,
    { flag: "a" },
  );
  ctx.note("marker", text);
  ctx.note("driven", "seed note → GET /api/mindlog + #mindlog shell");

  const logRes = await fetch(`${ctx.baseUrl}/api/mindlog?limit=10`);
  const log = await logRes.json();
  await writeFile(ctx.artifact("mindlog.json"), `${JSON.stringify(log, null, 2)}\n`);
  const found = (log.entries ?? []).some((e) => e.kind === "note" && e.text.includes(text));
  ctx.check("GET /api/mindlog includes seeded note", found);

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("mindlog")', { label: "mindlog pane" });
    const shell = await page.evaluate(`({
      mindlog: !!document.getElementById("mindlog"),
      think: !!document.getElementById("think"),
      mindlogOpen: !!document.getElementById("mindlog-open"),
    })`);
    ctx.check("page shell has #mindlog", shell.mindlog);
    ctx.check("page shell has Wake it (#think)", shell.think);
    await page.screenshot(ctx.artifact("mindlog-shell.png"));
  });
}
