import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { defineHook, type HookContext } from "eve/hooks";
import type { SandboxSession } from "eve/sandbox";

import { FILE as MINDLOG_FILE } from "../lib/mindlog";

// A cron wake-up is a new session, and a new session is a new container. Without
// this, everything the agent builds with bash dies at the end of the turn and it
// can only carry prose forward. So: unpack a tarball into /workspace when a
// session starts, pack it back up when the session parks.
//
// ponytail: one tarball, last-write-wins. The chat session and a heartbeat both
// snapshot to the same path, so whoever parks last wins. Per-session tarballs
// or a real file-level sync if that ever costs anything.
const ARCHIVE = process.env.WORKSPACE_ARCHIVE ?? ".data/workspace.tgz";
const SANDBOX_ARCHIVE = "/tmp/workspace-sync.tgz";
const MINDLOG_COPY = "/workspace/mindlog.jsonl";
const MINDLOG_IN_TAR = `./${MINDLOG_COPY.slice("/workspace/".length)}`;

async function restore(sandbox: SandboxSession): Promise<string> {
  let archive: Uint8Array;
  try {
    archive = await readFile(ARCHIVE);
  } catch {
    return "nothing kept yet";
  }

  await sandbox.writeBinaryFile({ path: SANDBOX_ARCHIVE, content: archive });
  const result = await sandbox.run({
    command: `mkdir -p /workspace && tar xzf ${SANDBOX_ARCHIVE} -C /workspace && rm -f ${SANDBOX_ARCHIVE}`,
  });
  return result.exitCode === 0 ? `restored ${archive.byteLength} bytes` : `restore failed: ${result.stderr}`;
}

async function snapshot(sandbox: SandboxSession): Promise<string> {
  // Exclude the mindlog copy: the real one lives on the host and is the source
  // of truth, so keeping a stale copy in the tarball would resurrect old lines.
  const packed = await sandbox.run({
    command: `tar czf ${SANDBOX_ARCHIVE} -C /workspace --exclude=${MINDLOG_IN_TAR} . && echo ok`,
  });
  if (packed.exitCode !== 0) return `pack failed: ${packed.stderr}`;

  const bytes = await sandbox.readBinaryFile({ path: SANDBOX_ARCHIVE });
  if (bytes === null) return "pack produced nothing";

  await mkdir(dirname(ARCHIVE), { recursive: true });
  await writeFile(ARCHIVE, bytes);
  return `kept ${bytes.byteLength} bytes`;
}

// The mindlog itself lives outside every sandbox, so bash cannot see it. Drop a
// fresh read-only copy in at the start of each turn: grep and jq then work on
// the agent's own memory. Appends still go through mindlog_append, so a script
// in the sandbox cannot corrupt the real log.
let copied = "";

async function refreshMindlogCopy(sandbox: SandboxSession): Promise<void> {
  try {
    const { size, mtimeMs } = await stat(MINDLOG_FILE);
    const stamp = `${sandbox.id}:${size}:${mtimeMs}`;
    if (stamp === copied) return; // nothing appended since the last turn
    const content = await readFile(MINDLOG_FILE, "utf8");
    await sandbox.writeTextFile({ path: MINDLOG_COPY, content });
    copied = stamp;
  } catch {}
}

const keep = async (_event: unknown, ctx: HookContext): Promise<void> => {
  console.info("[workspace-sync]", ctx.session.id, await snapshot(await ctx.getSandbox()));
};

// A parked session can resume, so its container stays. A completed one cannot,
// and its container would otherwise sit there forever: every heartbeat is its
// own session, so that is 96 idle containers a day. The workspace is already
// packed to the host by then, so nothing is lost by stopping the compute.
const keepAndStop = async (event: unknown, ctx: HookContext): Promise<void> => {
  await keep(event, ctx);
  await (await ctx.getSandbox()).stop();
};

export default defineHook({
  events: {
    async "session.started"(_event, ctx) {
      const sandbox = await ctx.getSandbox();
      const outcome = await restore(sandbox);
      console.info("[workspace-sync]", ctx.session.id, outcome);
    },
    async "turn.started"(_event, ctx) {
      await refreshMindlogCopy(await ctx.getSandbox());
    },
    // A session parks after most turns and completes when it ends for good.
    "session.waiting": keep,
    "session.completed": keepAndStop,
  },
});
