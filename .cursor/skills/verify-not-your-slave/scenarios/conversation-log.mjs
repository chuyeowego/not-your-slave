// Prove the left chat pane shows user messages (conversation log).
import { withPage } from "../lib/cdp.mjs";

const MARKER = `verify-conversation-${Date.now()}`;

export async function run(ctx) {
  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("input")', { label: "composer" });

    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(MARKER)}`);
    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    const visible = await page.waitFor(
      `Array.from(document.querySelectorAll("#chat .msg.me .body")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "user bubble in conversation log", timeoutMs: 15000 },
    );
    ctx.check("conversation log shows sent text immediately", visible === true);
    await page.screenshot(ctx.artifact("conversation-log.png"));
  });

  const heard = await waitMindlog(ctx, (entries) =>
    entries.find((e) => e.kind === "heard" && e.text.includes(MARKER)),
  );
  ctx.check("mindlog records heard for the same message", heard !== undefined, heard?.text?.slice(0, 80));
}

async function waitMindlog(ctx, pick, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { entries } = await (await fetch(`${ctx.baseUrl}/api/mindlog?limit=40`)).json();
    const hit = pick(entries);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
