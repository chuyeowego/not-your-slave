import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { MindlogEntry } from "#lib/mindlog.ts";

import { ToolSchema } from "./helpers/channel.ts";
import { IsolatedMindlog, type MindlogApi } from "./helpers/isolated-mindlog.ts";

class ToolSession {
  static ctx(id: string) {
    return { session: { id } } as never;
  }
}

describe("mindlog tools", () => {
  let store: IsolatedMindlog;
  let append: MindlogApi["append"];

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
    append = store.api.append;
  });

  afterEach(async () => {
    await store.close();
  });

  test("mindlog_append writes a note or thought with the session id", async () => {
    const tool = (await import("#tools/mindlog_append.ts")).default;
    const schema = ToolSchema.of(tool.inputSchema);
    expect(schema.safeParse({ kind: "note", text: "keep this" }).success).toBe(true);
    expect(schema.safeParse({ kind: "said", text: "nope" }).success).toBe(false);
    expect(schema.safeParse({ kind: "note", text: "" }).success).toBe(false);

    const result = await tool.execute({ kind: "note", text: "keep this" }, ToolSession.ctx("ses_tool"));
    expect(result).toEqual({ ok: true });

    const [entry] = await store.api.read();
    expect(entry).toMatchObject({ kind: "note", text: "keep this", sessionId: "ses_tool" });
  });

  test("mindlog_read returns the recent tail and validates limit", async () => {
    const tool = (await import("#tools/mindlog_read.ts")).default;
    const schema = ToolSchema.of(tool.inputSchema);
    expect(schema.parse({})).toEqual({ limit: 40 });
    expect(schema.safeParse({ limit: 0 }).success).toBe(false);
    expect(schema.safeParse({ limit: 201 }).success).toBe(false);

    await append({ kind: "note", text: "a" });
    await append({ kind: "note", text: "b" });
    await append({ kind: "note", text: "c" });

    const { entries } = (await tool.execute({ limit: 2 }, ToolSession.ctx("ses_tool"))) as {
      entries: MindlogEntry[];
    };
    expect(entries.map((entry) => entry.text)).toEqual(["b", "c"]);
  });

  test("mindlog_search returns matches, the query, and a count", async () => {
    const tool = (await import("#tools/mindlog_search.ts")).default;
    const schema = ToolSchema.of(tool.inputSchema);
    expect(schema.parse({ query: "x" })).toEqual({ query: "x", limit: 20 });
    expect(schema.safeParse({ query: "" }).success).toBe(false);

    await append({ kind: "note", text: "alpha" });
    await append({ kind: "note", text: "beta note" });
    await append({ kind: "thought", text: "ALPHA again" });

    const found = (await tool.execute({ query: "alpha", limit: 10 }, ToolSession.ctx("ses_tool"))) as {
      query: string;
      count: number;
      matches: MindlogEntry[];
    };
    expect(found.query).toBe("alpha");
    expect(found.count).toBe(2);
    expect(found.matches.map((entry) => entry.text)).toEqual(["alpha", "ALPHA again"]);
  });
});
