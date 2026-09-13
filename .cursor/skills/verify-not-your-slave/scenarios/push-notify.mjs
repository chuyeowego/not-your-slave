// Push notifications: VAPID configured, subscribe, test fanout delivers.
import { writeFile } from "node:fs/promises";

import { withPage } from "../lib/cdp.mjs";

const NOTIFY_LABELS = new Set(["test push", "failed", "blocked", "no vapid", "unsupported", "add to home"]);

const PUSH_CHECKS = [
  "GET /api/push/vapid returns public key",
  "headed Chrome available for push proof",
  "notify flow completes",
  "browser holds a push subscription",
  "POST /api/push/test delivers to stored subscription",
];

export async function run(ctx) {
  if (!ctx.hasVapid()) {
    for (const label of PUSH_CHECKS) {
      ctx.blocked(label, ctx.needVapid);
    }
    return;
  }

  const vapidRes = await fetch(`${ctx.baseUrl}/api/push/vapid`);
  const vapid = await vapidRes.json();
  ctx.check("GET /api/push/vapid returns public key", vapidRes.ok && typeof vapid.publicKey === "string");
  await writeFile(ctx.artifact("vapid.json"), `${JSON.stringify(vapid, null, 2)}\n`);

  ctx.check("headed Chrome available for push proof", Boolean(process.env.DISPLAY), "set DISPLAY and run on VM desktop");

  let subscription = null;
  let consoleLog = [];

  await withPage(
    async (page) => {
      await page.grantNotifications(ctx.baseUrl);
      await page.goto(ctx.baseUrl);
      await page.waitFor('!!document.getElementById("notify")', { label: "notify button" });
      await page.screenshot(ctx.artifact("before-notify.png"));

      await page.click("#notify");

      let label = await page.evaluate(`document.getElementById("notify").textContent`);
      const deadline = Date.now() + 90000;
      while (!NOTIFY_LABELS.has(label) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        label = await page.evaluate(`document.getElementById("notify").textContent`);
      }

      ctx.check("notify flow completes", NOTIFY_LABELS.has(label), `button reads "${label}"`);
      await page.screenshot(ctx.artifact("notify.png"));

      subscription = await page.evaluate(`(async () => {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return sub ? sub.toJSON() : null;
      })()`);
      ctx.check("browser holds a push subscription", subscription !== null);

      consoleLog = page.consoleLog;
    },
    { headed: true, notificationOrigin: ctx.baseUrl },
  );

  if (consoleLog.length > 0) {
    await writeFile(ctx.artifact("console-log.json"), `${JSON.stringify(consoleLog, null, 2)}\n`);
  }

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
