// Send text, reload, prove it still appears in mindlog pane and #chat.
import { withPage } from "../lib/cdp.mjs";

const MARKER = `verify-text-persist-${Date.now()}`;

export async function run(ctx) {
  ctx.note("marker", MARKER);
  ctx.note("driven", "composer submit → reload → #mindlog pane + #chat");

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("input")', { label: "composer" });

    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(MARKER)}`);
    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    const beforeSend = await page.waitForOptional(
      `Array.from(document.querySelectorAll("#chat .msg.me .body")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "message visible before reload", timeoutMs: 15000 },
    );
    ctx.check("message visible in #chat before reload", beforeSend.ok, beforeSend.ok ? "" : beforeSend.detail);
    await page.screenshot(ctx.artifact("before-reload.png"));

    const sessionBefore = await page.evaluate(
      `(async () => (await (await fetch("/api/session")).json()).sessionId)()`,
    );
    ctx.note("sessionIdBeforeReload", sessionBefore);
    ctx.check(
      "GET /api/session has id after send",
      sessionBefore !== null && sessionBefore !== undefined,
      sessionBefore ?? "null",
    );

    await page.evaluate("location.reload()");
    await page.waitFor('!!document.getElementById("mindlog")', { label: "page after reload" });

    const inMindlogPane = await page.waitForOptional(
      `Array.from(document.querySelectorAll("#mindlog .entry .text")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "text in mindlog pane after reload", timeoutMs: 20000 },
    );
    ctx.check("mindlog pane shows text after reload", inMindlogPane.ok, inMindlogPane.ok ? "" : inMindlogPane.detail);

    const inChat = await page.waitForOptional(
      `Array.from(document.querySelectorAll("#chat .msg.me .body")).some((el) => el.textContent.includes(${JSON.stringify(MARKER)}))`,
      { label: "text in conversation log after reload", timeoutMs: 45000 },
    );
    ctx.check("conversation log restores text after reload", inChat.ok, inChat.ok ? "" : inChat.detail);

    const sessionAfter = await page.evaluate(
      `(async () => (await (await fetch("/api/session")).json()).sessionId)()`,
    );
    ctx.note("sessionIdAfterReload", sessionAfter);
    await page.screenshot(ctx.artifact("after-reload.png"));
  });

  const heard = await waitMindlog(ctx, (entries) =>
    entries.find((e) => e.kind === "heard" && e.text.includes(MARKER)),
  );
  ctx.check("heard entry persists in /api/mindlog", heard !== undefined);
  if (heard) ctx.note("heardId", heard.id ?? heard.at);
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
