// Runnable check for the capture hook: see the check script in package.json.
//
// It lives here, not beside the hook: eve treats every file under agent/hooks
// as a hook and rejects a name with a dot in it.
//
// Covers the one branch that cannot be seen by reading a completed turn: a
// cancelled turn logs the text it had already streamed, and an unstarted one
// logs nothing.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = await mkdtemp(join(tmpdir(), "capture-check-"));
process.env.MINDLOG_FILE = join(dir, "mindlog.jsonl");

const hook = (await import("../agent/hooks/mindlog-capture.ts")).default;
const { read } = await import("../agent/lib/mindlog.ts");

const events = hook.events as Record<string, (event: unknown, ctx: unknown) => unknown>;
const ctx = { session: { id: "ses_check" }, channel: {} };
const fire = (type: string, data: Record<string, unknown>) => events[type]({ type, data }, ctx);

// A turn that streamed text and was then replaced keeps what it said.
await fire("message.appended", { turnId: "turn_a", messageSoFar: "half a thought about", messageDelta: "" });
await fire("turn.cancelled", { turnId: "turn_a" });

// A turn cancelled before the model spoke has nothing to log.
await fire("turn.cancelled", { turnId: "turn_b" });

// A completed turn logs its final message once, not the partial as well.
await fire("message.appended", { turnId: "turn_c", messageSoFar: "half of", messageDelta: "" });
await fire("message.completed", { turnId: "turn_c", message: "half of a finished answer" });
await fire("turn.cancelled", { turnId: "turn_c" });

const said = (await read()).filter((entry) => entry.kind === "said").map((entry) => entry.text);
assert.deepEqual(
  said,
  ["half a thought about […interrupted]", "half of a finished answer"],
  "a cancelled turn logs its partial once; an empty or completed turn adds nothing",
);

await rm(dir, { recursive: true, force: true });
console.log("mindlog capture check: ok");
process.exit(0);
