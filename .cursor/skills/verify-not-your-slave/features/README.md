# not-your-slave verification map

Read this index before driving. Each feature file is the recipe for one user-facing path.

## Baseline preconditions

- Node.js **>= 24**.
- `$H launch` with isolated `MINDLOG_FILE` / `PUSH_FILE` under `.run/<run-id>/`.
- `$H doctor` passes before any `drive` command.
- `.env.local` or `.env` at repo root for AI and VAPID credentials (see skill SKILL.md).

## Credentials (not letter tiers)

| Credential | Env vars | Required for |
| --- | --- | --- |
| AI gateway | `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` | Live `said`/`thought`, `#chat` restore after reload |
| VAPID | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | `push-notify` (headed Chrome) |

Each check is **passed**, **failed**, or **blocked** (`need <env var>`). Canonical wording: SKILL.md **Doctor** and `proof.html` credentials box.

## Driving conventions

- Browser: `verify-nys drive <scenario>` (uses `lib/cdp.mjs`).
- HTTP: `verify-nys api` or `curl` against `$BASE_URL` from state.
- Assert mindlog side effects, not DOM alone. Photos: `entries[].images[0].data` starts with `data:image/`.
- Evidence is **local only** (gitignored). Each drive writes **`proof.html`** + `result.json` under `evidence/<scenario>/<run-id>/`. Rollup: **`evidence/_runs/<run-id>/proof.html`**. See [`evidence/README.md`](../evidence/README.md).
- **`send-photo`**, **`photo-persist`**, **`say-limits`** need image upload on the branch ([PR #25](https://github.com/chuyeowego/not-your-slave/pull/25)); scenarios stay in this skill but fail against `main` until that product lands.

## Features

- [Conversation log](./conversation-log.md) — left pane shows user/agent messages from mindlog.
- [Text persists](./text-persist.md) — send text, reload, message still in the log.
- [Photo persists](./photo-persist.md) — attach photo, send, reload, image still in the log.
- [Attach a photo](./photo-upload.md) — composer attach, mindlog `heard` with bytes (no reload).
- [Wake it](./wake-it.md) — manual heartbeat button + `/api/think`.
- [Push notifications](./push-notifications.md) — Notify button, subscribe, test delivery.
- [Mindlog panel](./mindlog-panel.md) — right pane append-only log.
- [Chat](./chat.md) — send + stream reply (needs AI credential).
- [Entry page](./entry-page.md) — `/entry/:key` permalinks.
- [PWA install assets](./pwa-install.md) — public manifest, icons, service worker.
