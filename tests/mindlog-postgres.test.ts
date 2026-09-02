import { afterEach, describe, expect, test, vi } from "vitest";

import { MemoryPostgres } from "./helpers/memory-postgres.ts";

describe("mindlog postgres store", () => {
  afterEach(() => {
    vi.doUnmock("postgres");
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function load() {
    const memory = new MemoryPostgres();
    vi.resetModules();
    vi.doMock("postgres", () => ({ default: () => memory.tag }));
    vi.stubEnv("DATABASE_URL", "postgres://mindlog-test");
    const api = await import("#lib/mindlog.ts");
    return { api, memory };
  }

  test("blank entries are dropped and timestamps come from the row", async () => {
    const { api } = await load();
    await api.append({ kind: "note", text: "first thing" });
    await api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });
    await api.append({ kind: "said", text: "   " });

    const all = await api.read();
    expect(all).toHaveLength(2);
    expect(all[0].text).toBe("first thing");
    expect(all[1].text).toBe("Second Thing about BUSYWORK");
    expect(all[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(all[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  test("limit returns the newest tail and before pages older rows", async () => {
    const { api } = await load();
    await api.append({ kind: "note", text: "one" });
    await api.append({ kind: "note", text: "two" });
    await api.append({ kind: "note", text: "three" });

    expect((await api.read(2)).map((entry) => entry.text)).toEqual(["two", "three"]);
    const middle = (await api.read())[1];
    expect((await api.read(10, middle.at)).map((entry) => entry.text)).toEqual(["one"]);
  });

  test("search is case-insensitive and honours the limit", async () => {
    const { api } = await load();
    await api.append({ kind: "note", text: "first thing" });
    await api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });

    expect(await api.search("busywork")).toHaveLength(1);
    expect(await api.search("thing")).toHaveLength(2);
    expect(await api.search("nothing here")).toEqual([]);
    expect((await api.search("thing", 1))[0].text).toBe("Second Thing about BUSYWORK");
  });

  test("version uses count and last serial id", async () => {
    const { api } = await load();
    expect(await api.version()).toBe("0:0");
    await api.append({ kind: "note", text: "a" });
    expect(await api.version()).toBe("1:1");
    await api.append({ kind: "note", text: "b" });
    expect(await api.version()).toBe("2:2");
  });

  test("around looks up by entry_id and returns neighbours in order", async () => {
    const { api } = await load();
    await api.append({ kind: "note", text: "a" });
    await api.append({ kind: "note", text: "b" });
    await api.append({ kind: "note", text: "c" });

    const all = await api.read();
    const place = await api.around(all[1].id!, 1);
    expect(place?.entry.text).toBe("b");
    expect(place?.before.map((entry) => entry.text)).toEqual(["a"]);
    expect(place?.after.map((entry) => entry.text)).toEqual(["c"]);
    expect(await api.around("missing")).toBeNull();
  });

  test("around can find a legacy row by timestamp", async () => {
    const { api, memory } = await load();
    const at = new Date("2020-06-01T12:00:00.000Z");
    memory.rows.push({
      id: 7,
      entry_id: null,
      at,
      kind: "note",
      text: "legacy",
      session_id: null,
    });

    const place = await api.around(at.toISOString());
    expect(place?.entry.text).toBe("legacy");
    expect(place?.entry.id).toBeUndefined();
  });

  test("sessionId is persisted and long text is kept whole", async () => {
    const { api } = await load();
    const long = "x".repeat(9000);
    await api.append({ kind: "heard", text: long, sessionId: "ses_pg" });
    const [entry] = await api.read();
    expect(entry.text).toBe(long);
    expect(entry.sessionId).toBe("ses_pg");
  });
});
