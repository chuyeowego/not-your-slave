import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { IsolatedMindlog } from "./helpers/isolated-mindlog.ts";

describe("Push", () => {
  let store: IsolatedMindlog;

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
  });

  afterEach(async () => {
    const { Push } = await import("#lib/push.ts");
    await Push.disconnect();
    await store.close();
  });

  async function api() {
    return (await import("#lib/push.ts")).Push;
  }

  test("only said entries notify; woke never does", async () => {
    const Push = await api();
    expect(Push.shouldNotify("said")).toBe(true);
    expect(Push.shouldNotify("woke")).toBe(false);
    expect(Push.shouldNotify("heard")).toBe(false);
    expect(Push.shouldNotify("thought")).toBe(false);
    expect(Push.shouldNotify("did")).toBe(false);
    expect(Push.shouldNotify("note")).toBe(false);

    const send = vi.spyOn(Push, "send");
    expect(await Push.fanout("woke", "heartbeat")).toEqual({ ok: true, skipped: "kind" });
    expect(send).not.toHaveBeenCalled();
  });

  test("parseSubscription accepts a browser payload and rejects http off localhost", async () => {
    const Push = await api();
    expect(Push.parseSubscription(null)).toEqual({ ok: false, error: "endpoint required" });
    expect(Push.parseSubscription({ endpoint: "https://push.example/x" })).toEqual({
      ok: false,
      error: "keys.p256dh and keys.auth required",
    });
    expect(Push.parseSubscription({ endpoint: "http://evil.test/x", keys: { p256dh: "a", auth: "b" } })).toEqual({
      ok: false,
      error: "endpoint must be https (or localhost http)",
    });
    expect(Push.parseSubscription({
      endpoint: "http://127.0.0.1/push",
      keys: { p256dh: "a", auth: "b" },
    })).toEqual({
      ok: true,
      value: { endpoint: "http://127.0.0.1/push", p256dh: "a", auth: "b" },
    });
    expect(Push.parseSubscription({
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
      keys: { p256dh: "pkey", auth: "asecret" },
    })).toMatchObject({ ok: true });
  });

  test("file store upserts by endpoint and forgets on unsubscribe", async () => {
    const Push = await api();
    await Push.subscribe({ endpoint: "https://push.example/a", p256dh: "one", auth: "auth1" });
    await Push.subscribe({ endpoint: "https://push.example/a", p256dh: "two", auth: "auth2" });
    await Push.subscribe({ endpoint: "https://push.example/b", p256dh: "bee", auth: "authb" });

    expect(await Push.list()).toEqual([
      { endpoint: "https://push.example/a", p256dh: "two", auth: "auth2" },
      { endpoint: "https://push.example/b", p256dh: "bee", auth: "authb" },
    ]);

    await Push.unsubscribe("https://push.example/a");
    expect(await Push.list()).toEqual([
      { endpoint: "https://push.example/b", p256dh: "bee", auth: "authb" },
    ]);
  });

  test("send without VAPID is a dry skip, not a protocol fake", async () => {
    const Push = await api();
    await Push.subscribe({ endpoint: "https://push.example/a", p256dh: "one", auth: "auth1" });
    expect(await Push.send({ title: "t", body: "b", silentIfFocused: false })).toEqual({
      ok: true,
      skipped: "vapid",
    });
    expect(await Push.fanout("said", "a finished reply")).toEqual({ ok: true, skipped: "vapid" });
  });
});
