---
name: verify-not-your-slave
description: "Drive and prove not-your-slave locally: the eve agent web UI at http://127.0.0.1:2000 (chat + mindlog panel) and its HTTP API. Use before shipping UI/API changes, when debugging mindlog capture, or when an agent needs scripted end-to-end proof of this app."
---

# Verify not-your-slave

**not-your-slave** is an eve agent app whose primary surface is a **single-page web UI** (chat left, mindlog right) served by `eve dev` / `eve start`. Secondary surfaces: **HTTP JSON API** on the same origin (`/api/*`), **PWA install assets** (`/manifest.webmanifest`, `/sw.js`), and the **eve protocol** at `/eve/v1` (used by the page's live stream).

## Launch

**Requires Node.js >= 24** (`package.json` engines). On hosts where `/exec-daemon/node` is older, the helper prepends an nvm Node 24 install to `PATH`.

From the repo root:

```bash
.cursor/skills/verify-not-your-slave/helpers/verify-nys launch --port 2000
```

What it does:

- Sets `MINDLOG_FILE` to an isolated JSONL file under `.cursor/skills/verify-not-your-slave/.run/<run-id>/data/mindlog.jsonl` (no Postgres required).
- Runs `npm run dev -- --port <port> --no-ui` (equivalent to `eve dev`).
- `eve dev` sets `EVE_DEV=1`, so **localhost is open** — no `AGENT_USER` / `AGENT_PASS` needed.
- Writes state to `.cursor/skills/verify-not-your-slave/.run/<run-id>/state.env` with `PID`, `PORT`, `BASE_URL`, `MINDLOG_FILE`.

**Readiness:** `GET http://127.0.0.1:<port>/` returns `200` with `text/html` containing `an agent that thinks for itself`.

**Teardown:** `.cursor/skills/verify-not-your-slave/helpers/verify-nys cleanup` — kills the **PID from state**, removes the run directory, **never deletes evidence**.

**Isolation:** Default port is `2000`. Only one verification instance should bind a given port. Use `--port 2001` (or `VERIFY_NYS_PORT`) for a side-by-side run on another port with its own `MINDLOG_FILE`. Do **not** drive a dev server the user already has on that port — refuse and pick another port.

**Credentials (optional for most checks):**

- `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` in `.env.local` — required only for live LLM turns (`POST /api/say`, `POST /api/think` completing a reply).
- `VAPID_*` — required only for Web Push (`notify` button, `POST /api/push/test`).

File-backed mindlog works with zero extra env.

## Doctor

One read-only gate before driving:

```bash
.cursor/skills/verify-not-your-slave/helpers/verify-nys doctor
```

Pass criteria:

- State file exists for the latest (or `STATE_FILE`) run.
- `kill -0 $PID` succeeds.
- `GET $BASE_URL/` → 200.
- `GET $BASE_URL/api/session` → JSON with `sessionId` (may be `null` before first message).
- `MINDLOG_FILE` exists on disk.
- Printed `node` version is `v24+` and `pkg` matches `package.json`.

Exit code `0` = worth driving. Non-zero = run `cleanup`, fix launch (Node version, port conflict, build errors in `.run/<run-id>/dev.log`), relaunch.

## Drive

Harness: **`verify-nys`** (curl over the running instance). For browser-only flows (theme toggle, mobile mindlog drawer), use Playwright/CDP against `$BASE_URL` with the same selectors documented in feature files.

Always run `doctor` first. Pick a feature from [`features/README.md`](features/README.md).

### HTTP recipe (all features)

```bash
H=.cursor/skills/verify-not-your-slave/helpers/verify-nys

# Read mindlog (newest-first)
$H api GET '/api/mindlog?limit=20'

# Send a chat message (needs AI credentials; queues agent turn)
$H api POST /api/say '{"message":"hello from verification"}'

# Manual heartbeat (needs AI credentials)
$H api POST /api/think

# Session id
$H api GET /api/session

# Public PWA manifest (no auth)
curl -fsS "$BASE_URL/manifest.webmanifest"
```

### UI selectors (from `agent/lib/page.ts`)

| Control | Handle |
| --- | --- |
| Chat input | `#input` (textarea) |
| Send | `button[type=submit]` text **Send** |
| Status | `#status` |
| Open mindlog (mobile) | `#mindlog-open` text **mindlog** |
| Wake heartbeat | `#think` text **Wake it** |
| Close mindlog (mobile) | `#mindlog-close` aria-label **Close the mindlog** |
| Notify / push | `#notify` text **notify** |
| Theme | `#theme` aria-label **Switch theme** |
| Mindlog entries | `#mindlog .entry` with `.kind` and `.text` |
| Entry permalink | `#mindlog .entry .at` href `/entry/<id>` |

### Verification scaffolding

To prove read-only mindlog UI/API without calling the model, seed a note:

```bash
$H seed-note "verification probe"
```

This appends one JSONL `note` row to the run's `MINDLOG_FILE`. Remove seeded rows in fixture cleanup if the feature mutates data; keep proof artifacts.

## Evidence

Capture to:

```
.cursor/skills/verify-not-your-slave/evidence/<feature-id>/<run-id>/
```

Helper:

```bash
$H capture <feature-id> <label>
```

Writes `<label>.json` (`GET /api/mindlog` body), `<label>-home.html` (`GET /`), and `README.txt` metadata.

**Proof standards:**

- Exercise the **real user path** (page load + API the UI calls, or browser interaction).
- Capture **action + resulting state** (request/response bodies, HTML snippet), not only exit codes.
- Verify **side effects** (mindlog file line, JSON `entries` array) alongside visible UI.
- Mocks only at production boundaries (e.g. skip live LLM by using `seed-note` for mindlog-only proofs; label that as scaffolding).
- `POST /api/push/test` with no VAPID returns `503` `{ ok: true, skipped: "vapid" }` — that is expected, not a pass for push delivery.

**After `cleanup`:** evidence under `evidence/` must still exist. If cleanup removed it, the run failed.

## Cleanup

```bash
.cursor/skills/verify-not-your-slave/helpers/verify-nys cleanup
```

- Stops the **PID recorded in state** (never `pkill eve` / `killall node`).
- Deletes `.cursor/skills/verify-not-your-slave/.run/<run-id>/` (logs, isolated mindlog, state).
- **Does not** delete `.cursor/skills/verify-not-your-slave/evidence/`.

Run cleanup after every failed attempt to avoid stranded ports.

## Helpers

| Script | Purpose |
| --- | --- |
| `.cursor/skills/verify-not-your-slave/helpers/verify-nys` | launch, doctor, api, seed-note, capture, cleanup |

Make executable once per clone:

```bash
chmod +x .cursor/skills/verify-not-your-slave/helpers/verify-nys
```

Example end-to-end (mindlog panel, no AI key):

```bash
H=.cursor/skills/verify-not-your-slave/helpers/verify-nys
$H launch --port 2000
$H doctor
$H seed-note "verification probe"
$H api GET '/api/mindlog?limit=5'
$H capture mindlog-panel proof
$H cleanup
test -f .cursor/skills/verify-not-your-slave/evidence/mindlog-panel/*/proof.json
```
