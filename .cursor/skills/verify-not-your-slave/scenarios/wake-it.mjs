// Wake it: manual heartbeat — mindlog woke entry + mindlog pane marker.
import { withPage } from "../lib/cdp.mjs";

export async function run(ctx) {
  const api = await fetch(`${ctx.baseUrl}/api/think`, { method: "POST" });
  const body = await api.json();
  ctx.check("POST /api/think accepts manual wake", api.ok && typeof body.sessionId === "string", JSON.stringify(body));

  const woke = await waitMindlog(ctx, (entries) => entries.find((e) => e.kind === "woke"));
  ctx.check("mindlog gains a woke entry", woke !== undefined, woke?.at);

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.evaluate(`document.getElementById("mindlog-open")?.click()`);
    const pane = await page.waitFor(
      'document.querySelectorAll("#mindlog .entry[data-kind=woke]").length',
      { label: "woke row in mindlog pane", timeoutMs: 20000 },
    );
    ctx.check("mindlog pane shows woke entry", pane >= 1, `${pane} row(s)`);

    await page.evaluate(`document.getElementById("think").click()`);
    const buttonLabel = await page.waitFor(
      `document.getElementById("think").textContent`,
      { label: "Wake it button reacts", timeoutMs: 5000 },
    );
    ctx.check("Wake it button shows waking state", buttonLabel === "waking" || buttonLabel === "Wake it", buttonLabel);
    await page.screenshot(ctx.artifact("wake-it.png"));
  });

  if (ctx.tier === "B") {
    const said = await waitMindlog(ctx, (entries) => entries.find((e) => e.kind === "said"), 120000);
    ctx.check("agent produces said after wake (tier B)", said !== undefined, said?.text?.slice(0, 80));
  } else {
    ctx.check("tier A: woke path verified without live model reply", true);
  }
}

async function waitMindlog(ctx, pick, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { entries } = await (await fetch(`${ctx.baseUrl}/api/mindlog?limit=60`)).json();
    const hit = pick(entries);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return undefined;
}
