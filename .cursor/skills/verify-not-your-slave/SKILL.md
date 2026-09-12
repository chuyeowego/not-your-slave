---
name: verify-not-your-slave
description: Launch not-your-slave's web UI locally and drive it like a person — attach a photo in the composer, send it, watch it land in the mindlog — capturing screenshots and pass/fail checks as proof. Reach for this whenever a change touches agent/channels/home.ts, agent/lib/page.ts, agent/lib/say.ts, the mindlog, or the agent's handling of images, and you need evidence rather than a reading of the diff.
---

# Verifying not-your-slave

One eve agent app. One page at `/`: a chat composer on the left, the agent's
mindlog on the right, backed by one durable eve session. There is no test-only
entry point and no staging instance — verification means starting a real dev
server and clicking the real controls.

Everything below runs from the repo root. Paths are relative to this skill
directory (`.cursor/skills/verify-not-your-slave/`).

## Launch

```sh
.cursor/skills/verify-not-your-slave/bin/launch.sh --run-dir /tmp/nys-verify/$(date +%s)
```

It prints `ready: http://127.0.0.1:2999` when the dev server logs
`server listening`, and fails after 120s with the last 20 log lines. Flags:
`--port N` (default 2999), `--run-dir DIR` (default `/tmp/nys-verify/<timestamp>`),
`--sandbox just-bash|real`.

What it does, and why each part matters:

- **Node 24 or the launch is pointless.** eve refuses to start on anything
  older. The script uses `node` when it is already ≥24 and otherwise falls back
  to `~/.nvm/versions/node/v24.*/bin`. On this VM `/exec-daemon/node` (v22) wins
  PATH by default, so the fallback is the normal path, not the exception.
- **The sandbox is stubbed by default.** `--sandbox just-bash` writes
  `agent/sandbox.ts` — clearly marked verification scaffolding — pinning the
  backend to `justbash()`. The real default (Vercel Sandbox → Docker →
  microsandbox) boots a VM per session; on a machine without nested
  virtualisation it hangs for ~100s and then fails the turn, which looks
  exactly like an app bug. The script refuses to overwrite an existing
  `agent/sandbox.ts` and records which happened in `$RUN_DIR/scaffold.txt`, so
  cleanup only deletes a file this run created. Use `--sandbox real` where
  Docker or KVM actually works; nothing in the web surface needs it.
- **The mindlog is redirected.** `MINDLOG_FILE=$RUN_DIR/mindlog.jsonl` keeps the
  run out of `.data/mindlog.jsonl`, so driving the app never pollutes the
  user's own history.
- **Durable state is wiped first.** `.eve/.workflow-data`, `.eve/dev-runtime`
  and `.eve/dev-server-state.v1.json` are removed before start. A session left
  failed by an earlier run gets reused and silently swallows every new message.
- **It runs in tmux** (`nys-verify-<port>`, recorded in `$RUN_DIR/tmux-session`)
  with output teed to `$RUN_DIR/dev.log`.

**One instance per checkout — this is not negotiable.** Separate `--port` and
`--run-dir` values are not enough. `eve dev` owns `.eve/` for the whole
checkout, and on shutdown it acts on the `dev-cleanup-intent` it registered and
deletes the shared compile output. Stopping the second instance therefore guts
the first, which starts answering 500 with a missing
`.eve/compile/compiled-agent-manifest.json` — a failure that looks like an app
bug and is not one. The two would also fight over `agent/sandbox.ts`.

`launch.sh` refuses to start while another `nys-verify-*` tmux session exists
and tells you which one to clean up first. Relaunching on the *same* port is
fine: that replaces the instance rather than racing it. To verify two revisions
side by side, use two checkouts.

## Doctor

```sh
.cursor/skills/verify-not-your-slave/bin/doctor.sh --run-dir /tmp/nys-verify/<run>
```

Read-only; exits nonzero when something is wrong. It reports whether `/` answers
200, whether the HTML actually contains this app's markers (`id="composer"` and
`id="mindlog"` — a stray dev server from another checkout answers the port too),
the current session, how many mindlog entries exist, the sandbox backend parsed
out of `dev.log`, and the **tier**:

- **Tier A — no `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN`.** Everything up to
  the model call is verifiable: page, composer, `POST /api/say` and its limits,
  the `heard` mindlog entry with real image bytes, the mindlog pane, the error
  bubble. The turn ends with `[AI Gateway received no credentials.]` rendered in
  the window. At tier A that is a pass, not a failure.
- **Tier B — credential present.** Adds the reply itself: `thought`, `said` and
  `did` entries, streaming into the chat pane, and whether the model looked at
  an attached photo instead of trying to shell out and parse it.

Run doctor first whenever a drive fails, before assuming the app is broken.

## Drive

```sh
node .cursor/skills/verify-not-your-slave/bin/drive.mjs --list
node .cursor/skills/verify-not-your-slave/bin/drive.mjs send-photo --run-dir /tmp/nys-verify/<run>
```

Each scenario prints `PASS`/`FAIL` per check, writes `result.json`, and exits
nonzero if any check failed. Scenarios live in `scenarios/` and export
`run(ctx)`; `ctx` gives them `baseUrl`, `outDir`, `runDir`, `check(label, passed, detail)`
and `artifact(file)`.

Shipped scenarios:

- **`send-photo`** — the full user path. Attaches a real PNG through the actual
  `<input type=file>` via `DOM.setFileInputFiles`, types a caption, clicks the
  real submit button, then asserts the composer preview, the photo in the chat
  bubble, the composer clearing, a `heard` mindlog entry whose `images[0].data`
  starts with `data:image/png;base64,`, the caption surviving, the mindlog pane
  thumbnail, and no page errors.
- **`say-limits`** — the upload caps, driven against `POST /api/say` directly:
  empty message, non-image, oversize (>3 MiB), a fifth image, and four images
  accepted. The page enforces the same limits client-side, and a green UI over
  a permissive server is not a pass.

Browser work goes through `lib/cdp.mjs`, a zero-dependency Chrome DevTools
Protocol client (Node 24's global `WebSocket`; the repo ships no browser
tooling and does not need a Playwright dependency). `withPage(fn)` launches
headless Chrome on a throwaway profile and always tears it down. The `Page` it
hands you has `goto`, `evaluate`, `waitFor`, `attachFiles`, `screenshot`, and a
`consoleLog` array of every console message and page error.

Drive by the stable handles the app actually uses, listed in `agent/lib/page.ts`:
`#composer`, `#input`, `#files`, `#previews`, `#chat`, `.msg.me img.pic`,
`#mindlog`, `#mindlog-open`, `#think`, `#status`. Never coordinates.

`features/` is the maintained map of what a person can do here — five features,
each with how to reach it, how to drive it, and its gotchas. Start at
[`features/README.md`](features/README.md). A proof that drives only the
convenient entry point is incomplete when the map lists others.

## Evidence

Everything lands under the run dir, one subdirectory per scenario:

```
/tmp/nys-verify/<run>/
  dev.log              server output
  mindlog.jsonl        the agent's memory for this run only
  port, tmux-session, scaffold.txt
  send-photo/
    result.json        every check, with pass/fail and detail
    1-composed.png     the attachment previewed, before sending
    2-sent.png         the photo in the conversation
    3-mindlog.png      the mindlog pane showing it
    sent-photo.png     the fixture that was uploaded
```

Standards these scenarios hold to, and any new one must too: drive the real
user path (the file picker and the submit button, never a JS setter or a
test-only route); capture the action *and* the resulting state, not just the
final screen; and assert the side effect — a `heard` entry carrying inline
base64 bytes — alongside what is visible on screen. Nothing here is mocked:
the only stub is the sandbox backend, and that is a boundary the agent's web
surface never crosses.

## Cleanup

```sh
.cursor/skills/verify-not-your-slave/bin/cleanup.sh --run-dir /tmp/nys-verify/<run>
```

Kills the tmux session named in `$RUN_DIR/tmux-session`, kills the process
holding the port (found with `lsof`, never `pkill` by name — another checkout's
dev server is not ours to kill), deletes `agent/sandbox.ts` only when
`scaffold.txt` says this run created it, and clears the durable session state.

**The run dir survives**, evidence and all. Run cleanup after failed attempts
too, so a broken iteration does not strand a server on the port.

## Helpers

| Helper | Invocation |
| --- | --- |
| `bin/launch.sh` | `bin/launch.sh [--port N] [--run-dir DIR] [--sandbox just-bash\|real]` |
| `bin/doctor.sh` | `bin/doctor.sh [--port N] [--run-dir DIR]` |
| `bin/drive.mjs` | `node bin/drive.mjs <scenario> [--port N] [--run-dir DIR]`, or `--list` |
| `bin/cleanup.sh` | `bin/cleanup.sh [--port N] [--run-dir DIR]` |
| `lib/cdp.mjs` | `import { withPage } from "../lib/cdp.mjs"` |
| `lib/fixtures.mjs` | `pngFixture({ width, height, rgb })` builds real PNG bytes; `notAnImage()` |

All four `bin/` entries read `NYS_PORT` and `NYS_RUN_DIR` as well as the flags,
which is the tidier way to run several commands against one instance.

`--run-dir` alone is enough after launch: `launch.sh` records its port in
`$RUN_DIR/port`, and doctor, drive and cleanup read it back. Explicit `--port`
or `NYS_PORT` still wins. This matters most for cleanup — resolving the port
from the run dir is what stops it killing whatever else happens to hold 2999.
