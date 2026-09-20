import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { IsolatedMindlog } from "./helpers/isolated-mindlog.ts";

describe("mindlog-in-sandbox hook", () => {
  let store: IsolatedMindlog;

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
  });

  afterEach(async () => {
    await store.close();
  });

  test("copies recent entries on turn.started and stops a completed sandbox", async () => {
    await store.api.append({ kind: "note", text: "remembered" });
    await store.api.append({
      kind: "heard",
      text: "(image)",
      images: [{ data: "data:image/png;base64,abc", filename: "shot.png", mediaType: "image/png" }],
    });
    const hook = (await import("#hooks/mindlog-in-sandbox.ts")).default;
    const writeTextFile = vi.fn();
    const removePath = vi.fn();
    const stop = vi.fn();
    const ctx = {
      getSandbox: async () => ({ id: "box_1", writeTextFile, removePath, stop }),
    };

    await hook.events?.["turn.started"]?.({ type: "turn.started", data: {} } as never, ctx as never);
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile.mock.calls[0][0].path).toBe("/workspace/mindlog.jsonl");
    expect(writeTextFile.mock.calls[0][0].content).toContain("remembered");
    expect(writeTextFile.mock.calls[0][0].content).not.toContain("data:image");
    expect(removePath).toHaveBeenCalledWith({ path: "/workspace/notes", force: true, recursive: true });

    writeTextFile.mockClear();
    removePath.mockClear();
    await hook.events?.["turn.started"]?.({ type: "turn.started", data: {} } as never, ctx as never);
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(removePath).not.toHaveBeenCalled();

    await hook.events?.["session.completed"]?.({ type: "session.completed", data: {} } as never, ctx as never);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test("copies notebook pages into /workspace/notes on turn.started", async () => {
    const notes = await import("#lib/notes.ts");
    await notes.write("scratch", "hold this");
    await notes.write("projects/trip", "tickets");
    const hook = (await import("#hooks/mindlog-in-sandbox.ts")).default;
    const writeTextFile = vi.fn();
    const removePath = vi.fn();
    const ctx = {
      getSandbox: async () => ({ id: "box_notes", writeTextFile, removePath, stop: vi.fn() }),
    };

    await hook.events?.["turn.started"]?.({ type: "turn.started", data: {} } as never, ctx as never);
    expect(removePath).toHaveBeenCalledWith({ path: "/workspace/notes", force: true, recursive: true });
    expect(writeTextFile).toHaveBeenCalledWith({ path: "/workspace/notes/scratch", content: "hold this" });
    expect(writeTextFile).toHaveBeenCalledWith({
      path: "/workspace/notes/projects/trip",
      content: "tickets",
    });
  });
});
