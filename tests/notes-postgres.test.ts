import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { LivePostgres } from "./helpers/live-postgres.ts";

describe("notes postgres store", () => {
  let url: string;
  let sql: ReturnType<typeof postgres>;
  let notes: typeof import("#lib/notes.ts");

  beforeAll(async () => {
    url = await LivePostgres.ensureDatabase(LivePostgres.advertisedUrl());
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", url);
    delete process.env.POSTGRES_URL;
    notes = await import("#lib/notes.ts");
    sql = postgres(url, { max: 1 });
    await LivePostgres.ping(sql, url);
    await notes.list();
    console.log(
      `[notes-postgres] database host=${LivePostgres.describe(url).host} port=${LivePostgres.describe(url).port}`,
    );
  });

  beforeEach(async () => {
    await sql`truncate notes`;
  });

  afterAll(async () => {
    await notes?.disconnect();
    await sql?.end();
  });

  test("upserts by name and delete removes the row", async () => {
    await notes.write("scratch", "one");
    await notes.write("scratch", "two");
    expect(await notes.read("scratch")).toMatchObject({ name: "scratch", body: "two" });
    expect((await notes.read("scratch"))?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(await notes.remove("scratch")).toBe(true);
    expect(await notes.read("scratch")).toBeNull();
    expect(await notes.remove("scratch")).toBe(false);
  });

  test("list is sorted metadata; readAll includes bodies", async () => {
    await notes.write("zeta", "zzz");
    await notes.write("alpha", "aa");
    expect(await notes.list()).toEqual([
      { name: "alpha", chars: 2, updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      { name: "zeta", chars: 3, updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    ]);
    expect((await notes.readAll()).map((note) => note.body)).toEqual(["aa", "zzz"]);
  });

  test("blank pages and slashed names round-trip", async () => {
    await notes.write("projects/trip", "");
    expect(await notes.read("projects/trip")).toMatchObject({ name: "projects/trip", body: "" });
  });

  test("version changes when a page is written", async () => {
    const empty = await notes.version();
    expect(empty).toBe("0:0");
    await notes.write("a", "b");
    const after = await notes.version();
    expect(after).not.toBe(empty);
    expect(after.startsWith("1:")).toBe(true);
  });
});
