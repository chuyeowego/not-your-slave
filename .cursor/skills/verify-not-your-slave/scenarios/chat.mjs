// Chat via POST /api/say — same path as the composer; proves heard + session.
export async function run(ctx) {
  const message = `verify-chat-${Date.now()}`;
  ctx.note("marker", message);
  ctx.note("driven", "POST /api/say → poll /api/mindlog for heard");

  const sayRes = await fetch(`${ctx.baseUrl}/api/say`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const sayBody = await sayRes.json();
  ctx.check("POST /api/say accepts message", sayRes.ok && sayBody.ok === true, JSON.stringify(sayBody).slice(0, 120));
  if (sayBody.sessionId) ctx.note("sessionId", sayBody.sessionId);

  const heard = await waitMindlog(
    ctx,
    (entries) => entries.find((e) => e.kind === "heard" && e.text.includes(message)),
  );
  ctx.check("mindlog records heard for the message", heard !== undefined);

  const sessionRes = await fetch(`${ctx.baseUrl}/api/session`);
  const session = await sessionRes.json();
  ctx.note("sessionIdAfterSay", session.sessionId);
  ctx.check("GET /api/session returns sessionId after send", session.sessionId !== null && session.sessionId !== undefined);
}

async function waitMindlog(ctx, pick, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { entries } = await (await fetch(`${ctx.baseUrl}/api/mindlog?limit=20`)).json();
    const hit = pick(entries);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}
