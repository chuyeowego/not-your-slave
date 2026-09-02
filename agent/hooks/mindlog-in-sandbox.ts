import { defineHook, type HookContext } from "eve/hooks";
import type { SandboxSession } from "eve/sandbox";

import { read, version } from "../lib/mindlog";

// The agent lives in one durable session, and a session's sandbox keeps
// /workspace for as long as the session lives - natively, on every backend. So
// there is nothing to copy in or out; what is left is the one thing the sandbox
// cannot see by itself.
const MINDLOG_COPY = "/workspace/mindlog.jsonl";

let copied = "";

// The mindlog lives outside every sandbox - on the host, or in Postgres once a
// deployment has one - so bash cannot read it. Serialise the recent entries into
// /workspace at the start of each turn: grep and jq then work on the agent's own
// memory. Appends still go through mindlog_append, so a script in the sandbox
// cannot corrupt the real log.
const COPY_ENTRIES = 2000;

async function refreshMindlogCopy(sandbox: SandboxSession): Promise<void> {
  try {
    const stamp = `${sandbox.id}:${await version()}`;
    if (stamp === copied) return; // nothing appended since the last turn
    const entries = await read(COPY_ENTRIES);
    const content = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    await sandbox.writeTextFile({ path: MINDLOG_COPY, content });
    copied = stamp;
  } catch {}
}

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      await refreshMindlogCopy(await ctx.getSandbox());
    },
    // A completed session cannot resume, so its container would otherwise sit
    // there forever. A parked one keeps its compute so it can pick up again.
    async "session.completed"(_event: unknown, ctx: HookContext) {
      await (await ctx.getSandbox()).stop();
    },
  },
});
