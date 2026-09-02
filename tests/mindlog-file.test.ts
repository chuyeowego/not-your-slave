import { appendFile, writeFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Clock, IsolatedMindlog } from "./helpers/isolated-mindlog.ts";

describe("mindlog file store", () => {
  let store: IsolatedMindlog;

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
  });

  afterEach(async () => {
    await store.close();
  });

  test("a missing file reads as empty, not an error", async () => {
    expect(await store.api.read()).toEqual([]);
    expect(await store.api.version()).toBe("0");
  });

  test("FILE follows MINDLOG_FILE", () => {
    expect(store.api.FILE).toBe(store.file);
  });

  test("keyOf prefers id and falls back to at", () => {
    expect(store.api.keyOf({ at: "2020-01-01T00:00:00.000Z", kind: "note", text: "x", id: "abc" })).toBe("abc");
    expect(store.api.keyOf({ at: "2020-01-01T00:00:00.000Z", kind: "note", text: "x" })).toBe(
      "2020-01-01T00:00:00.000Z",
    );
  });

  test("blank entries are dropped and kept text is trimmed", async () => {
    await store.api.append({ kind: "note", text: "first thing" });
    await store.api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });
    await store.api.append({ kind: "said", text: "   " });
    await store.api.append({ kind: "note", text: "" });

    const all = await store.api.read();
    expect(all).toHaveLength(2);
    expect(all[0].text).toBe("first thing");
    expect(all[1].text).toBe("Second Thing about BUSYWORK");
    expect(all[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(all[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  test("sessionId is stored when provided and omitted when not", async () => {
    await store.api.append({ kind: "heard", text: "hello", sessionId: "ses_1" });
    await store.api.append({ kind: "note", text: "solo" });

    const [withSession, without] = await store.api.read();
    expect(withSession.sessionId).toBe("ses_1");
    expect(without.sessionId).toBeUndefined();
  });

  test("limit returns the newest tail", async () => {
    await store.api.append({ kind: "note", text: "one" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "two" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "three" });

    const tail = await store.api.read(2);
    expect(tail.map((entry) => entry.text)).toEqual(["two", "three"]);
  });

  test("before pages strictly older entries", async () => {
    await store.api.append({ kind: "note", text: "old" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "middle" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "new" });

    const all = await store.api.read();
    const older = await store.api.read(10, all[1].at);
    expect(older.map((entry) => entry.text)).toEqual(["old"]);
  });

  test("search is case-insensitive, text-only, and honours the limit", async () => {
    await store.api.append({ kind: "note", text: "first thing" });
    await store.api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });

    expect(await store.api.search("busywork")).toHaveLength(1);
    expect((await store.api.search("thing")).map((entry) => entry.text)).toEqual([
      "first thing",
      "Second Thing about BUSYWORK",
    ]);
    expect(await store.api.search("nothing here")).toEqual([]);
    expect(await store.api.search("thing", 1)).toHaveLength(1);
    expect((await store.api.search("thing", 1))[0].text).toBe("Second Thing about BUSYWORK");
    expect(await store.api.search("note")).toEqual([]);
  });

  test("long entries are kept whole", async () => {
    const long = "x".repeat(9000);
    await store.api.append({ kind: "note", text: long });
    expect((await store.api.read(1))[0].text).toBe(long);
  });

  test("version moves when an entry lands", async () => {
    const stamp = await store.api.version();
    await store.api.append({ kind: "note", text: "changes the version" });
    expect(await store.api.version()).not.toBe(stamp);
  });

  test("malformed JSONL lines are skipped", async () => {
    await writeFile(store.file, "not-json\n{\"broken\"\n", "utf8");
    await store.api.append({ kind: "note", text: "ok" });
    const all = await store.api.read();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe("ok");
  });

  test("around finds an entry by id and returns neighbours", async () => {
    await store.api.append({ kind: "note", text: "a" });
    await store.api.append({ kind: "note", text: "b" });
    await store.api.append({ kind: "note", text: "c" });
    await store.api.append({ kind: "note", text: "d" });
    await store.api.append({ kind: "note", text: "e" });

    const all = await store.api.read();
    const place = await store.api.around(all[2].id!, 1);
    expect(place).not.toBeNull();
    expect(place?.entry.text).toBe("c");
    expect(place?.before.map((entry) => entry.text)).toEqual(["b"]);
    expect(place?.after.map((entry) => entry.text)).toEqual(["d"]);
  });

  test("around returns null for an unknown key", async () => {
    await store.api.append({ kind: "note", text: "only" });
    expect(await store.api.around("missing")).toBeNull();
  });

  test("around falls back to at for entries written before ids", async () => {
    await appendFile(
      store.file,
      `${JSON.stringify({ at: "2019-01-01T00:00:00.000Z", kind: "note", text: "legacy" })}\n`,
      "utf8",
    );
    const place = await store.api.around("2019-01-01T00:00:00.000Z");
    expect(place?.entry.text).toBe("legacy");
    expect(place?.entry.id).toBeUndefined();
  });
});
