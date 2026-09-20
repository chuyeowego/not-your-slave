import { appendFile, writeFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { IsolatedNotes } from "./helpers/isolated-notes.ts";

describe("notes file store", () => {
  let store: IsolatedNotes;

  beforeEach(async () => {
    store = await IsolatedNotes.open();
  });

  afterEach(async () => {
    await store.close();
  });

  test("a missing file lists as empty, not an error", async () => {
    expect(await store.api.list()).toEqual([]);
    expect(await store.api.read("scratch")).toBeNull();
    expect(await store.api.version()).toBe("0");
  });

  test("FILE follows NOTES_FILE", () => {
    expect(store.api.FILE).toBe(store.file);
  });

  test("parseName is a key, not a path", () => {
    expect(store.api.parseName("scratch")).toBe("scratch");
    expect(store.api.parseName("projects/trip")).toBe("projects/trip");
    expect(store.api.parseName("  inbox  ")).toBe("inbox");
    expect(store.api.parseName("../etc/passwd")).toBeNull();
    expect(store.api.parseName("/abs")).toBeNull();
    expect(store.api.parseName("foo/../bar")).toBeNull();
    expect(store.api.parseName("foo//bar")).toBeNull();
    expect(store.api.parseName("foo/")).toBeNull();
    expect(store.api.parseName(".hidden")).toBeNull();
    expect(store.api.parseName("has space")).toBeNull();
    expect(store.api.parseName("")).toBeNull();
  });

  test("write creates, replaces, and keeps a blank page", async () => {
    const first = await store.api.write("scratch", "one");
    expect(first).toMatchObject({ name: "scratch", body: "one" });
    expect(first.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const again = await store.api.write("scratch", "two");
    expect(again.body).toBe("two");
    expect(await store.api.read("scratch")).toMatchObject({ name: "scratch", body: "two" });

    await store.api.write("empty", "");
    expect((await store.api.read("empty"))?.body).toBe("");
  });

  test("list is metadata only, sorted by name", async () => {
    await store.api.write("zeta", "zzz");
    await store.api.write("alpha", "a");

    expect(await store.api.list()).toEqual([
      { name: "alpha", chars: 1, updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      { name: "zeta", chars: 3, updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    ]);
    expect((await store.api.readAll()).map((note) => note.body)).toEqual(["a", "zzz"]);
  });

  test("remove deletes a page and a missing name is false", async () => {
    await store.api.write("keep", "yes");
    await store.api.write("drop", "no");
    expect(await store.api.remove("drop")).toBe(true);
    expect(await store.api.remove("drop")).toBe(false);
    expect(await store.api.list().then((pages) => pages.map((page) => page.name))).toEqual(["keep"]);
  });

  test("invalid names and overlong bodies are rejected", async () => {
    await expect(store.api.write("../x", "nope")).rejects.toThrow(/invalid note name/);
    await expect(store.api.write("ok", "x".repeat(store.api.NOTE_BODY_MAX + 1))).rejects.toThrow(/too long/);
    expect(await store.api.remove("../x")).toBe(false);
  });

  test("corrupt and illegal lines are skipped", async () => {
    await writeFile(store.file, "not-json\n", "utf8");
    await appendFile(store.file, `${JSON.stringify({ name: "../x", body: "bad" })}\n`, "utf8");
    await appendFile(store.file, `${JSON.stringify({ name: "ok", body: "kept" })}\n`, "utf8");

    expect(await store.api.readAll()).toEqual([
      expect.objectContaining({ name: "ok", body: "kept" }),
    ]);
  });

  test("version changes when a page is written", async () => {
    const empty = await store.api.version();
    await store.api.write("a", "b");
    const after = await store.api.version();
    expect(after).not.toBe(empty);
    expect(after).not.toBe("0");
  });
});
