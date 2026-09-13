# not-your-slave verification map

Read this index before driving. Each feature file is the recipe for one user-facing path.

## Baseline preconditions

- Node.js **>= 24**.
- `$H launch` with isolated `MINDLOG_FILE` / `PUSH_FILE` under `.run/<run-id>/`.
- `$H doctor` passes before any `drive` command.
- `.env.local` at repo root when testing tier **B** or push (see skill SKILL.md).

## Credential tiers

| Tier | When | Limits |
| --- | --- | --- |
| **A** | No AI gateway credential | Conversation log, text/photo `heard` + reload, `woke`, `say-limits`. Agent may error at model call — not a harness failure. |
| **B** | `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` | Adds live `said` / `thought` after chat or Wake it. |
| **Push** | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in `.env.local` | `push-notify` scenario only. |

## Driving conventions

- Browser: `verify-nys drive <scenario>` (uses `lib/cdp.mjs`).
- HTTP: `verify-nys api` or `curl` against `$BASE_URL` from state.
- Assert mindlog side effects, not DOM alone. Photos: `entries[].images[0].data` starts with `data:image/`.
- Evidence lives under `evidence/<scenario>/<run-id>/` and survives `cleanup`.

## Features

- [Conversation log](./conversation-log.md) — left pane shows user/agent messages from mindlog.
- [Text persists](./text-persist.md) — send text, reload, message still in the log.
- [Photo persists](./photo-persist.md) — attach photo, send, reload, image still in the log.
- [Attach a photo](./photo-upload.md) — composer attach, mindlog `heard` with bytes (no reload).
- [Wake it](./wake-it.md) — manual heartbeat button + `/api/think`.
- [Push notifications](./push-notifications.md) — Notify button, subscribe, test delivery.
- [Mindlog panel](./mindlog-panel.md) — right pane append-only log.
- [Chat](./chat.md) — send + stream reply (tier B).
- [Entry page](./entry-page.md) — `/entry/:key` permalinks.
- [PWA install assets](./pwa-install.md) — public manifest, icons, service worker.
