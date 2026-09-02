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
    const hook = (await import("#hooks/mindlog-in-sandbox.ts")).default;
    const writeTextFile = vi.fn();
    const stop = vi.fn();
    const ctx = {
      getSandbox: async () => ({ id: "box_1", writeTextFile, stop }),
    };

    await hook.events?.["turn.started"]?.({ type: "turn.started", data: {} } as never, ctx as never);
    expect(writeTextFile).toHaveBeenCalledTimes(1);
    expect(writeTextFile.mock.calls[0][0].path).toBe("/workspace/mindlog.jsonl");
    expect(writeTextFile.mock.calls[0][0].content).toContain("remembered");

    writeTextFile.mockClear();
    await hook.events?.["turn.started"]?.({ type: "turn.started", data: {} } as never, ctx as never);
    expect(writeTextFile).not.toHaveBeenCalled();

    await hook.events?.["session.completed"]?.({ type: "session.completed", data: {} } as never, ctx as never);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
