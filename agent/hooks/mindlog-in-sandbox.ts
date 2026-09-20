import { defineHook, type HookContext } from "eve/hooks";
import type { SandboxSession } from "eve/sandbox";

import { read, version, withoutImages } from "../lib/mindlog";
import { readAll, version as notesVersion } from "../lib/notes";

const MINDLOG_COPY = "/workspace/mindlog.jsonl";
const NOTES_DIR = "/workspace/notes";

let copied = "";
let notesCopied = "";

// The mindlog lives outside every sandbox - on the host, or in Postgres once a
// deployment has one - so bash cannot read it. Serialise the recent entries into
// /workspace at the start of each turn: grep and jq then work on the agent's own
// memory. Appends still go through mindlog_append, so a script in the sandbox
// cannot corrupt the real log.
const COPY_ENTRIES = 2000;

async function refreshMindlogCopy(sandbox: SandboxSession): Promise<void> {
  try {
    const stamp = `${sandbox.id}:${await version()}`;
    if (stamp === copied) return;
    const entries = await read(COPY_ENTRIES);
    const content = entries.map((entry) => JSON.stringify(withoutImages(entry))).join("\n") + "\n";
    await sandbox.writeTextFile({ path: MINDLOG_COPY, content });
    copied = stamp;
  } catch {}
}

// Same idea as the mindlog copy: the notebook lives on the host (or in
// Postgres), so bash can read the pages but cannot be the writer. A replace of
// the directory each turn drops pages that were deleted in the store.
async function refreshNotesCopy(sandbox: SandboxSession): Promise<void> {
  try {
    const stamp = `${sandbox.id}:${await notesVersion()}`;
    if (stamp === notesCopied) return;
    const pages = await readAll();
    await sandbox.removePath({ path: NOTES_DIR, force: true, recursive: true });
    for (const note of pages) {
      await sandbox.writeTextFile({ path: `${NOTES_DIR}/${note.name}`, content: note.body });
    }
    notesCopied = stamp;
  } catch {}
}

export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const sandbox = await ctx.getSandbox();
      await refreshMindlogCopy(sandbox);
      await refreshNotesCopy(sandbox);
    },
    // A completed session cannot resume, so its container would otherwise sit
    // there forever. A parked one keeps its compute so it can pick up again.
    async "session.completed"(_event: unknown, ctx: HookContext) {
      await (await ctx.getSandbox()).stop();
    },
  },
});
