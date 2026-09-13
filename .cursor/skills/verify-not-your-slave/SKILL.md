---
name: verify-not-your-slave
description: "Drive and prove not-your-slave locally: eve dev web UI (conversation log, text/photo send, Wake it, push) plus HTTP API. Use before shipping UI, mindlog, say, or push changes."
---

# Verify not-your-slave

**not-your-slave** is an eve agent app: one page at `/` (chat left, mindlog right), one durable session, HTTP API on the same origin. Verification starts a real `eve dev` server and drives real controls — no test-only routes.

Harness: **`.cursor/skills/verify-not-your-slave/helpers/verify-nys`** (launch, doctor, drive, cleanup). Browser scenarios use headless Chrome via `lib/cdp.mjs` (zero Playwright dependency).

## Launch

**Node.js >= 24** required. The helper prepends nvm Node 24 when `/exec-daemon/node` is older.

```bash
H=.cursor/skills/verify-not-your-slave/helpers/verify-nys
$H launch --port 2000 --run-id my-run
```

What launch does:

- Isolates `MINDLOG_FILE` and `PUSH_FILE` under `.cursor/skills/verify-not-your-slave/.run/<run-id>/data/`.
- Writes **`agent/sandbox.ts`** scaffolding (`justbash()` backend) unless one already exists without the verification marker. Use `--sandbox real` to skip.
- Clears **only** `.eve/.workflow-data` (stale session state); never deletes `.eve/dev-runtime`.
- Runs `npm run dev -- --port <port> --no-ui`; `EVE_DEV=1` keeps localhost open (no Basic auth).
- Loads **`.env.local`** from the repo root when present (`AI_GATEWAY_API_KEY`, `VAPID_*`, etc.).
- Records state in `.cursor/skills/verify-not-your-slave/.run/<run-id>/state.env`.

**Readiness:** `GET /` returns 200 with `id="composer"` and `id="mindlog"`.

**Teardown:** `$H cleanup` — kills the **PID from state**, removes sandbox scaffold if ours, deletes the run dir, **never** deletes `evidence/`.

**Isolation:** One instance per port. Use `--port 2001` for side-by-side runs. Do not drive a port you did not launch.

## Doctor

```bash
$H doctor
```

Pass: process alive, `/` has composer + mindlog markers, `/api/session` and `/api/mindlog` answer, mindlog file exists. Reports **tier**:

| Tier | Credential | What full proofs need |
| --- | --- | --- |
| **A** | No `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` | UI, `heard` mindlog rows, photo bytes, `woke` entries. Model reply may show `[AI Gateway received no credentials.]` — that is expected, not a failure. |
| **B** | AI credential in `.env.local` | Agent `said` / `thought` after chat or Wake it. |

**VAPID** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`) is separate — required only for `push-notify`.

## Drive

```bash
$H drive --list
$H drive conversation-log
$H drive text-persist
$H drive photo-persist
$H drive send-photo
$H drive say-limits
$H drive wake-it
$H drive push-notify
```

Each scenario writes `evidence/<scenario>/<run-id>/result.json` plus screenshots. Run `doctor` first.

### Stable UI handles (`agent/lib/page.ts`)

| Control | Handle |
| --- | --- |
| Chat input | `#input` |
| Send | `#composer button[type=submit]` |
| Attach | `#attach` → `#files` (`accept` image types) |
| Previews | `#previews img` |
| Conversation log | `#chat .msg.me`, `#chat .msg.it`, `#chat .woke` |
| User images in log | `#chat .msg.me img.pic` |
| Status | `#status` |
| Wake it | `#think` |
| Mindlog pane | `#mindlog`, `#mindlog-open` |
| Notify | `#notify` |

### HTTP shortcuts

```bash
$H api POST /api/say '{"message":"hello"}'
$H api POST /api/think
$H api GET '/api/mindlog?limit=20'
curl -fsS "$BASE_URL/manifest.webmanifest"
```

Multipart photos (same as the page): `message` + `images` file parts on `POST /api/say`.

## Evidence

```
.cursor/skills/verify-not-your-slave/evidence/<scenario>/<run-id>/
  result.json          every check with pass/fail
  *.png                screenshots
```

**Proof standards:** real user path (file picker, submit, Wake button, Notify flow); capture action **and** side effect (`heard` with inline `data:image/` bytes in `/api/mindlog`); after `cleanup`, evidence must still exist.

## Cleanup

```bash
$H cleanup
```

Kills recorded PID only (never `pkill eve`). Removes run dir and verification `agent/sandbox.ts` when marked. Keeps `evidence/`. Run after failed attempts.

## Helpers

| Path | Role |
| --- | --- |
| `helpers/verify-nys` | launch, doctor, drive, api, cleanup |
| `helpers/drive.mjs` | scenario runner |
| `lib/cdp.mjs` | headless Chrome CDP (`withPage`) |
| `lib/fixtures.mjs` | `pngFixture()` for real PNG bytes |
| `scenarios/*.mjs` | one feature per file |

Example (tier A, no AI key):

```bash
H=.cursor/skills/verify-not-your-slave/helpers/verify-nys
$H launch --port 2001 --run-id prove-a
$H doctor
$H drive conversation-log
$H drive text-persist
$H drive photo-persist
$H drive wake-it
$H cleanup
```

Feature recipes: [`features/README.md`](features/README.md). Keep the map honest with `/maintain-verification-skill`.
