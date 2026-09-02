import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Mindlog from "./mindlog.ts";

describe("mindlog file store", () => {
  let dir: string;
  let mindlog: typeof Mindlog;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "mindlog-"));
    process.env.MINDLOG_FILE = join(dir, "mindlog.jsonl");
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    vi.resetModules();
    mindlog = await import("./mindlog.ts");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reads a missing file as empty, not an error", async () => {
    expect(await mindlog.read()).toEqual([]);
  });

  it("reports version 0 when the file is missing", async () => {
    expect(await mindlog.version()).toBe("0");
  });

  it("drops blank entries and timestamps the rest", async () => {
    await mindlog.append({ kind: "note", text: "first thing" });
    await mindlog.append({ kind: "thought", text: "Second Thing about BUSYWORK" });
    await mindlog.append({ kind: "said", text: "   " });

    const all = await mindlog.read();
    expect(all).toHaveLength(2);
    expect(all[1].text).toBe("Second Thing about BUSYWORK");
    expect(all[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("read(limit) returns the newest tail", async () => {
    await mindlog.append({ kind: "note", text: "first thing" });
    await mindlog.append({ kind: "thought", text: "Second Thing about BUSYWORK" });

    const tail = await mindlog.read(1);
    expect(tail).toHaveLength(1);
    expect(tail[0].text).toBe("Second Thing about BUSYWORK");
  });

  it("search is case-insensitive and limited", async () => {
    await mindlog.append({ kind: "note", text: "first thing" });
    await mindlog.append({ kind: "thought", text: "Second Thing about BUSYWORK" });

    expect(await mindlog.search("busywork")).toHaveLength(1);
    expect(await mindlog.search("thing")).toHaveLength(2);
    expect(await mindlog.search("nothing here")).toHaveLength(0);
    expect(await mindlog.search("thing", 1)).toHaveLength(1);
  });

  it("search matches text, not kind or other metadata", async () => {
    await mindlog.append({ kind: "note", text: "hello" });
    expect(await mindlog.search("note")).toHaveLength(0);
    expect(await mindlog.search("hello")).toHaveLength(1);
  });

  it("keeps sessionId on append", async () => {
    await mindlog.append({ kind: "note", text: "hello", sessionId: "sess-1" });
    expect((await mindlog.read())[0].sessionId).toBe("sess-1");
  });

  it("skips corrupt JSONL lines", async () => {
    await writeFile(
      mindlog.FILE,
      `not-json\n${JSON.stringify({ at: "2026-01-01T00:00:00.000Z", kind: "note", text: "ok" })}\n`,
    );
    expect(await mindlog.read()).toEqual([
      { at: "2026-01-01T00:00:00.000Z", kind: "note", text: "ok" },
    ]);
  });

  it("truncates long entries to 4000 characters plus an ellipsis", async () => {
    await mindlog.append({ kind: "note", text: "x".repeat(5000) });
    const text = (await mindlog.read(1))[0].text;
    expect(text).toHaveLength(4001);
    expect(text.endsWith("…")).toBe(true);
  });

  it("moves version() when an entry lands", async () => {
    await mindlog.append({ kind: "note", text: "before" });
    const stamp = await mindlog.version();
    await mindlog.append({ kind: "note", text: "changes the version" });
    expect(await mindlog.version()).not.toBe(stamp);
  });
});
