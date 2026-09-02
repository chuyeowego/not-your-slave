import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { Clock } from "./helpers/isolated-mindlog.ts";
import { LivePostgres } from "./helpers/live-postgres.ts";

describe("mindlog postgres store", () => {
  let store: LivePostgres;

  beforeAll(async () => {
    store = await LivePostgres.open();
    // Proof this suite talked to a server, not the old tagged-template fake.
    console.log(
      `[mindlog-postgres] ${store.fingerprint.version} database=${store.fingerprint.database} host=${store.fingerprint.host} port=${store.fingerprint.port}`,
    );
  });

  beforeEach(async () => {
    await store.reset();
  });

  afterEach(() => {
    expect(process.env.DATABASE_URL).toBe(store.url);
  });

  afterAll(async () => {
    await store?.close();
  });

  test("blank entries are dropped and timestamps come from the row", async () => {
    await store.api.append({ kind: "note", text: "first thing" });
    await store.api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });
    await store.api.append({ kind: "said", text: "   " });

    const all = await store.api.read();
    expect(all).toHaveLength(2);
    expect(all[0].text).toBe("first thing");
    expect(all[1].text).toBe("Second Thing about BUSYWORK");
    expect(all[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(all[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  test("limit returns the newest tail by serial id", async () => {
    await store.api.append({ kind: "note", text: "one" });
    await store.api.append({ kind: "note", text: "two" });
    await store.api.append({ kind: "note", text: "three" });

    expect((await store.api.read(2)).map((entry) => entry.text)).toEqual(["two", "three"]);
  });

  test("before pages strictly older timestamptz rows when milliseconds differ", async () => {
    await store.api.append({ kind: "note", text: "one" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "two" });
    await Clock.nextMs();
    await store.api.append({ kind: "note", text: "three" });

    const all = await store.api.read();
    expect(all.map((entry) => entry.text)).toEqual(["one", "two", "three"]);
    expect(all[0].at < all[1].at).toBe(true);
    expect(all[1].at < all[2].at).toBe(true);
    expect((await store.api.read(10, all[1].at)).map((entry) => entry.text)).toEqual(["one"]);
  });

  test("before does not walk past siblings that share a millisecond ISO at", async () => {
    await store.insertRaw({
      at: "2020-06-01T12:00:00.000100+00:00",
      entry_id: "aa0000000001",
      text: "early-us",
    });
    await store.insertRaw({
      at: "2020-06-01T12:00:00.000900+00:00",
      entry_id: "aa0000000002",
      text: "late-us",
    });

    const all = await store.api.read();
    expect(all.map((entry) => entry.text)).toEqual(["early-us", "late-us"]);
    expect(all[0].at).toBe("2020-06-01T12:00:00.000Z");
    expect(all[1].at).toBe("2020-06-01T12:00:00.000Z");
    // `at < '…000Z'` is false for both microsecond siblings, so ISO paging
    // cannot name the earlier one the way the file store's string compare can.
    expect(await store.api.read(10, all[1].at)).toEqual([]);
  });

  test("search uses real ILIKE (case-insensitive, _ is a wildcard)", async () => {
    await store.api.append({ kind: "note", text: "first thing" });
    await store.api.append({ kind: "thought", text: "Second Thing about BUSYWORK" });

    expect(await store.api.search("busywork")).toHaveLength(1);
    expect(await store.api.search("thing")).toHaveLength(2);
    expect(await store.api.search("nothing here")).toEqual([]);
    expect((await store.api.search("thing", 1))[0].text).toBe("Second Thing about BUSYWORK");

    const wildcard = await store.api.search("busy_ork");
    expect(wildcard).toHaveLength(1);
    expect(wildcard[0].text).toBe("Second Thing about BUSYWORK");
  });

  test("version matches live count and max serial", async () => {
    const empty = await store.serial();
    expect(await store.api.version()).toBe(`${empty.n}:${empty.last}`);
    expect(empty.n).toBe(0);

    await store.api.append({ kind: "note", text: "a" });
    const afterOne = await store.serial();
    expect(await store.api.version()).toBe(`${afterOne.n}:${afterOne.last}`);
    expect(afterOne.n).toBe(1);
    expect(afterOne.last).toBeGreaterThan(0);

    await store.api.append({ kind: "note", text: "b" });
    const afterTwo = await store.serial();
    expect(await store.api.version()).toBe(`${afterTwo.n}:${afterTwo.last}`);
    expect(afterTwo.n).toBe(afterOne.n + 1);
    expect(afterTwo.last).toBeGreaterThan(afterOne.last);
  });

  test("around looks up by entry_id and returns neighbours in order", async () => {
    await store.api.append({ kind: "note", text: "a" });
    await store.api.append({ kind: "note", text: "b" });
    await store.api.append({ kind: "note", text: "c" });

    const all = await store.api.read();
    const place = await store.api.around(all[1].id!, 1);
    expect(place?.entry.text).toBe("b");
    expect(place?.before.map((entry) => entry.text)).toEqual(["a"]);
    expect(place?.after.map((entry) => entry.text)).toEqual(["c"]);
    expect(await store.api.around("missing")).toBeNull();
  });

  test("around finds a legacy row via date_trunc milliseconds, not seconds", async () => {
    await store.insertRaw({
      at: "2020-06-01T12:00:00.500100+00:00",
      entry_id: null,
      text: "legacy",
    });

    const place = await store.api.around("2020-06-01T12:00:00.500Z");
    expect(place?.entry.text).toBe("legacy");
    expect(place?.entry.id).toBeUndefined();
    expect(place?.entry.at).toBe("2020-06-01T12:00:00.500Z");

    // date_trunc('seconds', at) would have matched 12:00:00.000Z.
    expect(await store.api.around("2020-06-01T12:00:00.000Z")).toBeNull();
  });

  test("sessionId is persisted and long text is kept whole", async () => {
    const long = "x".repeat(9000);
    await store.api.append({ kind: "heard", text: long, sessionId: "ses_pg" });
    const [entry] = await store.api.read();
    expect(entry.text).toBe(long);
    expect(entry.sessionId).toBe("ses_pg");
  });
});
