import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { IsolatedMindlog, type MindlogApi } from "./helpers/isolated-mindlog.ts";

type HookEvents = Record<string, (event: unknown, ctx: unknown) => unknown>;

describe("mindlog capture hook", () => {
  let store: IsolatedMindlog;
  let events: HookEvents;
  let read: MindlogApi["read"];

  beforeEach(async () => {
    store = await IsolatedMindlog.open();
    const hook = (await import("#hooks/mindlog-capture.ts")).default;
    events = hook.events as HookEvents;
    read = store.api.read;
  });

  afterEach(async () => {
    await store.close();
  });

  const ctx = { session: { id: "ses_check" }, channel: {} };
  const fire = (type: string, data: Record<string, unknown>, channel: Record<string, unknown> = {}) =>
    events[type]({ type, data }, { ...ctx, channel: { ...ctx.channel, ...channel } });

  test("a cancelled turn logs its partial once; an empty or completed turn adds nothing extra", async () => {
    await fire("message.appended", { turnId: "turn_a", messageSoFar: "half a thought about", messageDelta: "" });
    await fire("turn.cancelled", { turnId: "turn_a" });

    await fire("turn.cancelled", { turnId: "turn_b" });

    await fire("message.appended", { turnId: "turn_c", messageSoFar: "half of", messageDelta: "" });
    await fire("message.completed", { turnId: "turn_c", message: "half of a finished answer" });
    await fire("turn.cancelled", { turnId: "turn_c" });

    const said = (await read()).filter((entry) => entry.kind === "said").map((entry) => entry.text);
    expect(said).toEqual(["half a thought about […interrupted]", "half of a finished answer"]);
  });

  test("a human message is heard; the heartbeat constant and a schedule channel are woke", async () => {
    const { HEARTBEAT } = await import("#schedules/think.ts");

    await fire("message.received", { message: "hello there" });
    await fire("message.received", { message: HEARTBEAT });
    await fire("message.received", { message: "  still a person  " }, { kind: "schedule" });

    const entries = await read();
    expect(entries.map((entry) => [entry.kind, entry.text])).toEqual([
      ["heard", "hello there"],
      ["woke", "heartbeat"],
      ["woke", "heartbeat"],
    ]);
    expect(entries.every((entry) => entry.sessionId === "ses_check")).toBe(true);
  });

  test("reasoning lands as thought", async () => {
    await fire("reasoning.completed", { reasoning: "maybe the log is enough" });
    expect((await read())[0]).toMatchObject({ kind: "thought", text: "maybe the log is enough" });
  });

  test("a null completed message is not logged", async () => {
    await fire("message.completed", { turnId: "turn_empty", message: null });
    expect(await read()).toEqual([]);
  });

  test("turn.failed drops the streaming buffer so a later cancel is silent", async () => {
    await fire("message.appended", { turnId: "turn_fail", messageSoFar: "almost" });
    await fire("turn.failed", { turnId: "turn_fail" });
    await fire("turn.cancelled", { turnId: "turn_fail" });
    expect(await read()).toEqual([]);
  });

  test("action.result names tools, subagents, and skills", async () => {
    await fire("action.result", {
      status: "ok",
      result: { kind: "tool-result", toolName: "mindlog_read" },
    });
    await fire("action.result", {
      status: "error",
      result: { kind: "subagent-result", subagentName: "researcher" },
    });
    await fire("action.result", {
      status: "ok",
      result: { kind: "skill", name: "neon" },
    });
    await fire("action.result", {
      status: "ok",
      result: { kind: "skill" },
    });

    expect((await read()).map((entry) => entry.text)).toEqual([
      "mindlog_read (ok)",
      "subagent researcher (error)",
      "skill neon (ok)",
      "skill ? (ok)",
    ]);
    expect((await read()).every((entry) => entry.kind === "did")).toBe(true);
  });
});
