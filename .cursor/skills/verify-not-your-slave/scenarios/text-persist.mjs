// Send text, reload, prove it still appears (chat at tier B; mindlog pane at tier A).
import { withPage } from "../lib/cdp.mjs";

const MARKER = `verify-text-persist-${Date.now()}`;

export async function run(ctx) {
  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("input")', { label: "composer" });

    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(MARKER)}`);
    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);
    await page.waitFor(
      `Array.from(document.querySelectorAll("#chat .msg.me .body")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "message visible before reload", timeoutMs: 15000 },
    );
    await page.screenshot(ctx.artifact("before-reload.png"));

    await page.evaluate("location.reload()");
    await page.waitFor('!!document.getElementById("mindlog")', { label: "page after reload" });

    // Right pane polls /api/mindlog without needing a live session.
    const inMindlogPane = await page.waitFor(
      `Array.from(document.querySelectorAll("#mindlog .entry .text")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "text in mindlog pane after reload", timeoutMs: 20000 },
    );
    ctx.check("mindlog pane shows text after reload (tier A+)", inMindlogPane === true);

    if (ctx.tier === "B") {
      const inChat = await page.waitFor(
        `Array.from(document.querySelectorAll("#chat .msg.me .body")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
        { label: "text in conversation log after reload", timeoutMs: 45000 },
      );
      ctx.check("conversation log restores text after reload (tier B)", inChat === true);
    } else {
      ctx.check(
        "tier A: conversation-log reload deferred",
        true,
        "add AI_GATEWAY_API_KEY to .env.local for #chat restore after reload",
      );
    }
    await page.screenshot(ctx.artifact("after-reload.png"));
  });

  const heard = await waitMindlog(ctx, (entries) =>
    entries.find((e) => e.kind === "heard" && e.text.includes(MARKER)),
  );
  ctx.check("heard entry persists in /api/mindlog", heard !== undefined);
}

async function waitMindlog(ctx, pick, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { entries } = await (await fetch(`${ctx.baseUrl}/api/mindlog?limit=40`)).json();
    const hit = pick(entries);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
