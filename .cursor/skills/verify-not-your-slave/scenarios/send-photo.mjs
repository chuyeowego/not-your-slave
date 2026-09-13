// Attach a photo in the composer the way a person does — file picker, caption,
// Send — and prove it reached the agent's memory as pixels, not as a filename.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";
import { pngFixture } from "../lib/fixtures.mjs";

const CAPTION = `verify-send-photo-${Date.now()}`;

export async function run(ctx) {
  ctx.note("marker", CAPTION);
  ctx.note("driven", "attach #files → caption → submit → /api/mindlog heard bytes");

  const photo = ctx.artifact("sent-photo.png");
  await writeFile(photo, pngFixture({ rgb: [220, 40, 40] }));

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("composer")', { label: "composer rendered" });

    await page.attachFiles("#files", [photo]);
    await page.evaluate(`document.getElementById("input").value = ${JSON.stringify(CAPTION)}`);

    const previews = await page.waitForOptional(
      'document.querySelectorAll("#previews img").length',
      { label: "thumbnail appears in the composer before sending" },
    );
    ctx.check("composer previews the attachment", previews.ok && previews.value === 1, `${previews.value} preview(s)`);
    await page.screenshot(ctx.artifact("1-composed.png"));

    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    const bubble = await page.waitForOptional(
      `Array.from(document.querySelectorAll("#chat .msg.me")).some((m) => m.querySelector("img.pic") && m.textContent.includes(${JSON.stringify(CAPTION)}))`,
      { label: "the photo appears in the conversation for this caption", timeoutMs: 20000 },
    );
    ctx.check("photo renders in the chat bubble for this send", bubble.ok, bubble.ok ? "" : bubble.detail);

    const cleared = await page.waitForOptional('document.querySelectorAll("#previews img").length === 0', {
      label: "composer clears after send",
    });
    ctx.check("composer clears after send", cleared.ok && cleared.value === true, cleared.ok ? "" : cleared.detail);
    await page.screenshot(ctx.artifact("2-sent.png"));

    const heard = await waitMindlog(
      ctx,
      (entries) =>
        entries.find((e) => e.kind === "heard" && (e.images ?? []).length > 0 && e.text.includes(CAPTION)),
    );
    ctx.check("mindlog heard entry carries the image", (heard?.images ?? []).length === 1);
    ctx.check(
      "stored image is inline data, not a path",
      heard?.images?.[0]?.data?.startsWith("data:image/png;base64,"),
      heard?.images?.[0]?.data?.slice(0, 32) ?? "no heard row",
    );
    ctx.check("caption is preserved", heard?.text?.includes(CAPTION) === true, heard?.text?.split("\n")[0] ?? "");

    await page.evaluate(`document.getElementById("mindlog-open")?.click()`);
    const paneHit = await page.waitForOptional(
      `Array.from(document.querySelectorAll("#mindlog .entry .text")).some((el) => el.textContent.includes(${JSON.stringify(CAPTION)}))`,
      { label: "the mindlog pane shows this caption", timeoutMs: 15000 },
    );
    ctx.check("mindlog pane renders the thumbnail row", paneHit.ok, paneHit.ok ? "" : paneHit.detail);
    await page.screenshot(ctx.artifact("3-mindlog.png"));

    const errors = page.consoleLog.filter((entry) => entry.kind === "pageerror" || entry.kind === "error");
    ctx.check("no page errors", errors.length === 0, errors.map((entry) => entry.text).join(" | "));
  });
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
