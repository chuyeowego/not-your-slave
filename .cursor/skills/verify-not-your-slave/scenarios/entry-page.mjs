// Entry permalink: seed a note, open /entry/:id, assert 404 for missing keys.
import { writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export async function run(ctx) {
  const text = `entry bookmark test ${Date.now()}`;
  const id = randomBytes(6).toString("hex");
  const at = new Date().toISOString();
  const mindlogFile = ctx.state.MINDLOG_FILE;
  await writeFile(
    mindlogFile,
    `${JSON.stringify({ id, at, kind: "note", text })}\n`,
    { flag: "a" },
  );
  ctx.note("entryId", id);
  ctx.note("driven", `seed-note → GET /entry/${id} + 404 probe`);

  const pageRes = await fetch(`${ctx.baseUrl}/entry/${id}`);
  const html = await pageRes.text();
  await writeFile(ctx.artifact("entry.html"), html);
  ctx.check("GET /entry/:id returns 200 with entry text", pageRes.ok && html.includes(text));

  const missing = await fetch(`${ctx.baseUrl}/entry/does-not-exist-${id}`);
  const missingBody = await missing.text();
  ctx.check("unknown entry returns 404", missing.status === 404 && missingBody.includes("No such entry"));
}
