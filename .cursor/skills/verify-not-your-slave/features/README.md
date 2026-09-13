# not-your-slave verification map

Maintained source for verifying user-facing behavior of **not-your-slave**. Read this index before driving the app; open the matching feature file for the recipe.

## Baseline preconditions

- Node.js **>= 24** on `PATH` (eve refuses older Node).
- Launch with `.cursor/skills/verify-not-your-slave/helpers/verify-nys launch` so `MINDLOG_FILE` is isolated under `.run/<run-id>/`.
- Default URL: `http://127.0.0.1:2000` (override with `--port` / `VERIFY_NYS_PORT`).
- `verify-nys doctor` must pass before any feature drive.
- Never drive a server you did not start in this verification run (port conflict → pick another port).

## Driving conventions

- Start from baseline unless a feature file says otherwise.
- Prefer stable handles from `agent/lib/page.ts`: `#input`, `#think`, `#mindlog`, button text **Send** / **Wake it** / **notify**.
- HTTP checks use `verify-nys api` or `curl` against `$BASE_URL` from state.
- Live LLM features need `AI_GATEWAY_API_KEY` or linked `VERCEL_OIDC_TOKEN` in `.env.local`.
- Web Push features need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in env.
- Restore seeded mindlog rows after mutation tests; never delete `evidence/` during cleanup.

## Proof and skip reporting

- Capture user action and resulting state (JSON + HTML or screenshot).
- Record `feature-id`, `run-id`, and entry point in `evidence/<feature>/<run-id>/README.txt`.
- If AI credentials are missing, report chat/wake-it as **blocked** — do not claim verified via a different path.
- `POST /api/push/test` without VAPID is a documented skip, not delivery proof.

## Feature entry contract

Each feature file: H1 title, one paragraph, then H2s in order: **Sub-features**, **How to get to it (user POV)**, **Driving it with verify-nys**, **Gotchas**.

## Features

- [Chat](./chat.md) — send a message from the composer; mindlog records `heard` / `said`.
- [Mindlog panel](./mindlog-panel.md) — append-only log in the right pane; `/api/mindlog` polling.
- [Wake it](./wake-it.md) — manual heartbeat while `eve dev` skips cron.
- [Entry page](./entry-page.md) — bookmarkable `/entry/:key` for one mindlog row.
- [PWA install assets](./pwa-install.md) — public manifest, icons, service worker.
