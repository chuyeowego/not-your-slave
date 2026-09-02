import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { HomeRoutes } from "./helpers/channel.ts";
import { Clock, IsolatedMindlog } from "./helpers/isolated-mindlog.ts";

describe("home channel routes", () => {
  let store: IsolatedMindlog;

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
    process.env.EVE_DEV = "1";
    delete process.env.AGENT_USER;
    delete process.env.AGENT_PASS;
  });

  afterEach(async () => {
    delete process.env.EVE_DEV;
    await store.close();
  });

  async function channel() {
    return (await import("#channels/home.ts")).default;
  }

  test("receive forwards onto the shared timeline address", async () => {
    const send = vi.fn().mockResolvedValue({ id: "ses_1" });
    const from = vi.fn().mockReturnValue({ send });
    const home = await channel();
    if (home.receive === undefined) throw new Error("home.receive missing");
    await home.receive({ message: "hello", auth: null, target: {} }, { from } as never);
    expect(from).toHaveBeenCalledWith("timeline");
    expect(send).toHaveBeenCalledWith("hello", { auth: null });
  });

  test("GET / fills the wake prefix and serves HTML", async () => {
    const { HEARTBEAT } = await import("#schedules/think.ts");
    const home = await channel();
    const res = await HomeRoutes.handler(home, "GET", "/")(new Request("http://local/"), HomeRoutes.args());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain(JSON.stringify(HEARTBEAT.split("\n")[0]));
    expect(html).not.toContain("__WAKE_PREFIX__");
  });

  test("GET /entry/:key 404s, then renders a found neighbourhood", async () => {
    const home = await channel();
    const missing = await HomeRoutes.handler(home, "GET", "/entry/:key")(
      new Request("http://local/entry/nope"),
      HomeRoutes.args({ params: { key: "nope" } }),
    );
    expect(missing.status).toBe(404);

    await store.api.append({ kind: "said", text: "bookmark me" });
    const [entry] = await store.api.read();
    const found = await HomeRoutes.handler(home, "GET", "/entry/:key")(
      new Request(`http://local/entry/${entry.id}`),
      HomeRoutes.args({ params: { key: entry.id! } }),
    );
    expect(found.status).toBe(200);
    expect(await found.text()).toContain("bookmark me");
  });

  test("GET /api/session reports the current timeline session", async () => {
    const home = await channel();
    const empty = await HomeRoutes.handler(home, "GET", "/api/session")(
      new Request("http://local/api/session"),
      HomeRoutes.args({ resolveSession: async () => undefined }),
    );
    expect(await empty.json()).toEqual({ sessionId: null });

    const present = await HomeRoutes.handler(home, "GET", "/api/session")(
      new Request("http://local/api/session"),
      HomeRoutes.args({ resolveSession: async () => ({ id: "ses_live" }) as never }),
    );
    expect(await present.json()).toEqual({ sessionId: "ses_live" });
  });

  test("POST /api/say rejects an empty body and sends a real message", async () => {
    const send = vi.fn().mockResolvedValue({ id: "ses_say" });
    const home = await channel();
    const bad = await HomeRoutes.handler(home, "POST", "/api/say")(
      new Request("http://local/api/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "   " }),
      }),
      HomeRoutes.args(),
    );
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: "message required" });

    const ok = await HomeRoutes.handler(home, "POST", "/api/say")(
      new Request("http://local/api/say", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      }),
      HomeRoutes.args({ from: (() => ({ send })) as never }),
    );
    expect(await ok.json()).toEqual({ ok: true, sessionId: "ses_say" });
    expect(send).toHaveBeenCalledWith("hello", { auth: null });
  });

  test("GET /api/mindlog pages, etags, and answers 304", async () => {
    const home = await channel();
    await store.api.append({ kind: "note", text: "alpha" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "beta" });

    const first = await HomeRoutes.handler(home, "GET", "/api/mindlog")(
      new Request("http://local/api/mindlog?limit=1"),
      HomeRoutes.args(),
    );
    const body = await first.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].text).toBe("beta");
    const etag = first.headers.get("etag");
    expect(etag).toMatch(/^W\//);

    const cached = await HomeRoutes.handler(home, "GET", "/api/mindlog")(
      new Request("http://local/api/mindlog?limit=1", { headers: { "if-none-match": etag! } }),
      HomeRoutes.args(),
    );
    expect(cached.status).toBe(304);

    const older = await HomeRoutes.handler(home, "GET", "/api/mindlog")(
      new Request(`http://local/api/mindlog?before=${encodeURIComponent(body.entries[0].at)}`),
      HomeRoutes.args(),
    );
    expect((await older.json()).entries.map((entry: { text: string }) => entry.text)).toEqual(["alpha"]);
  });

  test("POST /api/think queues the heartbeat", async () => {
    const { HEARTBEAT } = await import("#schedules/think.ts");
    const send = vi.fn().mockResolvedValue({ id: "ses_think" });
    const home = await channel();
    const res = await HomeRoutes.handler(home, "POST", "/api/think")(
      new Request("http://local/api/think", { method: "POST" }),
      HomeRoutes.args({ from: (() => ({ send })) as never }),
    );
    expect(await res.json()).toEqual({ sessionId: "ses_think" });
    expect(send).toHaveBeenCalledWith(HEARTBEAT, { auth: null, turnPolicy: "queue" });
  });

  test("routes refuse traffic when localDev is off and no credentials are set", async () => {
    delete process.env.EVE_DEV;
    const home = await channel();
    const res = await HomeRoutes.handler(home, "GET", "/")(new Request("http://example.test/"), HomeRoutes.args());
    expect(res.status).toBe(401);
  });
});
