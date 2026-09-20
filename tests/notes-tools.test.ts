import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { Note, NoteMeta } from "#lib/notes.ts";

import { ToolSchema } from "./helpers/channel.ts";
import { IsolatedNotes } from "./helpers/isolated-notes.ts";

class ToolSession {
  static ctx(id: string) {
    return { session: { id } } as never;
  }
}

describe("notes tools", () => {
  let store: IsolatedNotes;

  beforeEach(async () => {
    store = await IsolatedNotes.open();
  });

  afterEach(async () => {
    await store.close();
  });

  test("notes_write replaces a page and notes_read returns it", async () => {
    const write = (await import("#tools/notes_write.ts")).default;
    const read = (await import("#tools/notes_read.ts")).default;
    const schema = ToolSchema.of(write.inputSchema);
    expect(schema.safeParse({ name: "scratch", body: "hello" }).success).toBe(true);
    expect(schema.safeParse({ name: "../x", body: "no" }).success).toBe(false);
    expect(schema.safeParse({ name: "ok", body: "x".repeat(store.api.NOTE_BODY_MAX + 1) }).success).toBe(
      false,
    );

    const written = (await write.execute({ name: "scratch", body: "hello" }, ToolSession.ctx("ses"))) as {
      ok: true;
      note: Note;
    };
    expect(written.ok).toBe(true);
    expect(written.note).toMatchObject({ name: "scratch", body: "hello" });

    const found = (await read.execute({ name: "scratch" }, ToolSession.ctx("ses"))) as {
      ok: true;
      note: Note;
    };
    expect(found).toMatchObject({ ok: true, note: { name: "scratch", body: "hello" } });
  });

  test("notes_read and notes_delete report a missing page", async () => {
    const read = (await import("#tools/notes_read.ts")).default;
    const del = (await import("#tools/notes_delete.ts")).default;
    expect(await read.execute({ name: "gone" }, ToolSession.ctx("ses"))).toEqual({
      ok: false,
      error: "missing",
      name: "gone",
    });
    expect(await del.execute({ name: "gone" }, ToolSession.ctx("ses"))).toEqual({
      ok: false,
      error: "missing",
      name: "gone",
    });
  });

  test("notes_list returns metadata and notes_delete removes a page", async () => {
    const write = (await import("#tools/notes_write.ts")).default;
    const list = (await import("#tools/notes_list.ts")).default;
    const del = (await import("#tools/notes_delete.ts")).default;

    await write.execute({ name: "zeta", body: "zzz" }, ToolSession.ctx("ses"));
    await write.execute({ name: "alpha", body: "a" }, ToolSession.ctx("ses"));

    const listed = (await list.execute({}, ToolSession.ctx("ses"))) as { count: number; notes: NoteMeta[] };
    expect(listed.count).toBe(2);
    expect(listed.notes.map((note) => note.name)).toEqual(["alpha", "zeta"]);
    expect(listed.notes[0]?.chars).toBe(1);

    expect(await del.execute({ name: "zeta" }, ToolSession.ctx("ses"))).toEqual({
      ok: true,
      name: "zeta",
    });
    expect((await store.api.list()).map((note) => note.name)).toEqual(["alpha"]);
  });
});
