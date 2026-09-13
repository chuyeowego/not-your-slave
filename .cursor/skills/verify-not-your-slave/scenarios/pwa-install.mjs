// Public PWA assets: manifest, service worker, icon.
import { writeFile } from "node:fs/promises";

export async function run(ctx) {
  ctx.note("driven", "curl manifest.webmanifest, sw.js, icon-192.png");

  const manifestRes = await fetch(`${ctx.baseUrl}/manifest.webmanifest`);
  const manifest = await manifestRes.json();
  await writeFile(ctx.artifact("manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  ctx.check("manifest returns 200", manifestRes.ok);
  ctx.check('manifest display is standalone', manifest.display === "standalone");
  ctx.check('manifest start_url is /', manifest.start_url === "/");
  ctx.check("manifest name mentions agent", String(manifest.name ?? "").toLowerCase().includes("agent"));

  const headRes = await fetch(`${ctx.baseUrl}/manifest.webmanifest`, { method: "HEAD" });
  ctx.check("manifest HEAD returns 200", headRes.ok);

  const swRes = await fetch(`${ctx.baseUrl}/sw.js`);
  const sw = await swRes.text();
  await writeFile(ctx.artifact("sw.js.txt"), sw);
  ctx.check("sw.js contains push handler", sw.includes('addEventListener("push"'));
  ctx.check("sw.js contains showNotification", sw.includes("showNotification"));

  const iconRes = await fetch(`${ctx.baseUrl}/icon-192.png`);
  const icon = Buffer.from(await iconRes.arrayBuffer());
  await writeFile(ctx.artifact("icon-192.png"), icon);
  ctx.check("icon-192.png is PNG", icon[0] === 0x89 && icon[1] === 0x50);
}
