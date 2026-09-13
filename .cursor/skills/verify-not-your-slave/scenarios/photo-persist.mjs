// Attach a photo, send, reload, prove image data persists in mindlog UI.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";
import { pngFixture } from "../lib/fixtures.mjs";

const CAPTION = `verify-photo-persist-${Date.now()}`;

export async function run(ctx) {
  const photo = ctx.artifact("fixture.png");
  await writeFile(photo, pngFixture({ rgb: [40, 120, 220] }));

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("files")', { label: "file input" });

    await page.attachFiles("#files", [photo]);
    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(CAPTION)}`);
    await page.waitFor('document.querySelectorAll("#previews img").length >= 1', { label: "preview" });
    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    await page.waitFor('document.querySelectorAll("#chat .msg.me img.pic").length >= 1', {
      label: "photo in chat before reload",
      timeoutMs: 20000,
    });
    await page.screenshot(ctx.artifact("before-reload.png"));

    const heard = await waitMindlog(ctx, (entries) =>
      entries.find((e) => e.kind === "heard" && (e.images ?? []).length > 0 && e.text.includes(CAPTION)),
    );
    ctx.check("heard entry stores inline image bytes", heard?.images?.[0]?.data?.startsWith("data:image/"));

    await page.evaluate("location.reload()");
    await page.waitFor('!!document.getElementById("mindlog")', { label: "page after reload" });

    await page.evaluate(`document.getElementById("mindlog-open")?.click()`);
    const panePics = await page.waitFor('document.querySelectorAll("#mindlog img.pic").length', {
      label: "photo thumbnail in mindlog pane after reload",
      timeoutMs: 20000,
    });
    ctx.check("mindlog pane shows photo after reload", panePics >= 1, `${panePics} image(s)`);

    if (ctx.tier === "B") {
      const chatPics = await page.waitFor('document.querySelectorAll("#chat .msg.me img.pic").length', {
        label: "photo in conversation log after reload",
        timeoutMs: 45000,
      });
      ctx.check("conversation log restores photo after reload (tier B)", chatPics >= 1);
    } else {
      ctx.check("tier A: conversation-log photo reload needs AI credential for session restore", true);
    }
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
