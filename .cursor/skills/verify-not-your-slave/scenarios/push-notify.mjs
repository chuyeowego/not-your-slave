// Push notifications: VAPID configured, subscribe, test fanout delivers.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";

export async function run(ctx) {
  if (ctx.state.VAPID_CREDENTIAL !== "present") {
    ctx.check("VAPID keys configured", false, "set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local");
    return;
  }

  const vapidRes = await fetch(`${ctx.baseUrl}/api/push/vapid`);
  const vapid = await vapidRes.json();
  ctx.check("GET /api/push/vapid returns public key", vapidRes.ok && typeof vapid.publicKey === "string");
  await writeFile(ctx.artifact("vapid.json"), `${JSON.stringify(vapid, null, 2)}\n`);

  let subscription = null;
  await withPage(async (page) => {
    await page.goto(ctx.baseUrl);
    await page.waitFor('!!document.getElementById("notify")', { label: "notify button" });

    await page.grantNotifications(ctx.baseUrl);

    await page.evaluate(`document.getElementById("notify").click()`);

    const label = await page.waitFor(
      `document.getElementById("notify").textContent`,
      { label: "notify button settles", timeoutMs: 30000 },
    );
    ctx.check("notify flow completes", label === "test push" || label === "failed", `button reads "${label}"`);
    await page.screenshot(ctx.artifact("notify.png"));

    subscription = await page.evaluate(`(async () => {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    })()`);
    ctx.check("browser holds a push subscription", subscription !== null);
  });

  if (subscription) {
    await writeFile(ctx.artifact("subscription.json"), `${JSON.stringify(subscription, null, 2)}\n`);
  }

  const testRes = await fetch(`${ctx.baseUrl}/api/push/test`, { method: "POST" });
  const testBody = await testRes.json();
  await writeFile(ctx.artifact("push-test.json"), `${JSON.stringify({ status: testRes.status, body: testBody }, null, 2)}\n`);
  ctx.check(
    "POST /api/push/test delivers to stored subscription",
    testRes.ok && testBody.ok === true && (testBody.sent ?? 0) >= 1,
    JSON.stringify(testBody),
  );
}
