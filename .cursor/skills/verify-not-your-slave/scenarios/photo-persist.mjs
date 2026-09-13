// Attach a photo, send, reload, prove image data persists in mindlog UI.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";
import { pngFixture } from "../lib/fixtures.mjs";

const CAPTION = `verify-photo-persist-${Date.now()}`;

export async function run(ctx) {
  ctx.note("marker", CAPTION);
  ctx.note("driven", "attach #files → submit → reload → #mindlog pane + #chat");

  const photo = ctx.artifact("fixture.png");
  await writeFile(photo, pngFixture({ rgb: [40, 120, 220] }));

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("files")', { label: "file input" });

    await page.attachFiles("#files", [photo]);
    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(CAPTION)}`);
    const preview = await page.waitForOptional('document.querySelectorAll("#previews img").length >= 1', {
      label: "preview",
      timeoutMs: 10000,
    });
    ctx.check("composer preview before send", preview.ok, preview.ok ? "" : preview.detail);
    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    const beforeChat = await page.waitForOptional('document.querySelectorAll("#chat .msg.me img.pic").length >= 1', {
      label: "photo in chat before reload",
      timeoutMs: 20000,
    });
    ctx.check("photo in #chat before reload", beforeChat.ok, beforeChat.ok ? "" : beforeChat.detail);
    await page.screenshot(ctx.artifact("before-reload.png"));

    const heard = await waitMindlog(ctx, (entries) =>
      entries.find((e) => e.kind === "heard" && (e.images ?? []).length > 0 && e.text.includes(CAPTION)),
    );
    ctx.check("heard entry stores inline image bytes", heard?.images?.[0]?.data?.startsWith("data:image/"));

    await page.evaluate("location.reload()");
    await page.waitFor('!!document.getElementById("mindlog")', { label: "page after reload" });

    await page.evaluate(`document.getElementById("mindlog-open")?.click()`);
    const panePics = await page.waitForOptional('document.querySelectorAll("#mindlog img.pic").length', {
      label: "photo thumbnail in mindlog pane after reload",
      timeoutMs: 20000,
    });
    ctx.check(
      "mindlog pane shows photo after reload",
      panePics.ok && panePics.value >= 1,
      panePics.ok ? `${panePics.value} image(s)` : panePics.detail,
    );

    if (!ctx.hasAi()) {
      ctx.blocked("conversation log restores photo after reload", ctx.needAi);
    } else {
      const chatPics = await page.waitForOptional('document.querySelectorAll("#chat .msg.me img.pic").length', {
        label: "photo in conversation log after reload",
        timeoutMs: 45000,
      });
      ctx.check(
        "conversation log restores photo after reload",
        chatPics.ok && chatPics.value >= 1,
        chatPics.ok ? `${chatPics.value} image(s)` : chatPics.detail,
      );
    }

    const sessionAfter = await page.evaluate(
      `(async () => (await (await fetch("/api/session")).json()).sessionId)()`,
    );
    ctx.note("sessionIdAfterReload", sessionAfter);
    await page.screenshot(ctx.artifact("after-reload.png"));
  });
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
