// Attach a photo in the composer the way a person does — file picker, caption,
// Send — and prove it reached the agent's memory as pixels, not as a filename.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";
import { pngFixture } from "../lib/fixtures.mjs";

export async function run(ctx) {
  const photo = ctx.artifact("sent-photo.png");
  await writeFile(photo, pngFixture({ rgb: [220, 40, 40] }));

  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("composer")', { label: "composer rendered" });

    await page.attachFiles("#files", [photo]);
    await page.evaluate(`document.getElementById("input").value = "what is in this picture"`);

    const previews = await page.waitFor(
      'document.querySelectorAll("#previews img").length',
      { label: "thumbnail appears in the composer before sending" },
    );
    ctx.check("composer previews the attachment", previews === 1, `${previews} preview(s)`);
    await page.screenshot(ctx.artifact("1-composed.png"));

    await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);

    const bubblePics = await page.waitFor(
      'document.querySelectorAll("#chat .msg.me img.pic").length',
      { label: "the photo appears in the conversation" },
    );
    ctx.check("photo renders in the chat bubble", bubblePics === 1, `${bubblePics} image(s)`);

    const cleared = await page.waitFor('document.querySelectorAll("#previews img").length === 0', {
      label: "composer clears after send",
    });
    ctx.check("composer clears after send", cleared === true);
    await page.screenshot(ctx.artifact("2-sent.png"));

    // The side effect that matters: the agent's own memory, not the DOM.
    const entries = await page.waitFor(
      `(async () => {
         const { entries } = await (await fetch("/api/mindlog?limit=20")).json();
         const heard = entries.filter((e) => e.kind === "heard" && (e.images || []).length > 0);
         return heard.length ? heard : null;
       })()`,
      { label: "a heard entry with image bytes lands in the mindlog", timeoutMs: 30000 },
    );
    const heard = entries[entries.length - 1];
    ctx.check("mindlog heard entry carries the image", (heard.images ?? []).length === 1);
    ctx.check(
      "stored image is inline data, not a path",
      heard.images[0].data.startsWith("data:image/png;base64,"),
      heard.images[0].data.slice(0, 32),
    );
    ctx.check("caption is preserved", heard.text.includes("what is in this picture"), heard.text.split("\n")[0]);

    // The mindlog pane is where a photo stays visible across reloads today.
    await page.evaluate(`document.getElementById("mindlog-open").click()`);
    const panePics = await page.waitFor('document.querySelectorAll("#mindlog img.pic").length', {
      label: "the mindlog pane shows the photo",
    });
    ctx.check("mindlog pane renders the thumbnail", panePics >= 1, `${panePics} image(s)`);
    await page.screenshot(ctx.artifact("3-mindlog.png"));

    const errors = page.consoleLog.filter((entry) => entry.kind === "pageerror" || entry.kind === "error");
    ctx.check("no page errors", errors.length === 0, errors.map((entry) => entry.text).join(" | "));
  });
}
