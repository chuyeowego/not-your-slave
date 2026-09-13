# Push notifications

Web Push: **Notify** requests permission, subscribes via `/api/push/subscribe`, and `/api/push/test` sends a forced notification. Completed `said` entries also fan out when configured.

## Sub-features

- `push-vapid` — `GET /api/push/vapid` returns the public key or honest 503.
- `push-subscribe` — stores subscription in `PUSH_FILE` or Postgres.
- `push-test` — `POST /api/push/test` delivers `"push is on"`.
- `push-said-fanout` — automatic on new `said` when AI credential is present (not covered by `push-notify` scenario).

## How to get to it (user POV)

Open `/`, click **notify**, accept the browser prompt. Button should read **test push** and a notification arrives.

## Driving it with verify-nys

Preconditions:

- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env.local` or `.env` (generate with `npx web-push generate-vapid-keys`).
- Optional `VAPID_SUBJECT=mailto:you@example.com` (never `@localhost`).

```bash
verify-nys drive push-notify
```

- Runs **headed** Chrome on the VM desktop (`DISPLAY` required; headless CDP cannot complete subscribe).
- Seeds notification allow in the throwaway profile and calls `Browser.grantPermissions` on the app origin.
- Clicks `#notify`; expects button **test push**.
- Asserts a push subscription exists in the browser.
- `POST /api/push/test` returns `sent >= 1`.

Proof: `vapid.json`, `subscription.json`, `push-test.json`, `before-notify.png`, `notify.png`.

## Gotchas

- **Blocked without VAPID** — checks are marked `BLOCKED` with `need VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY`; scenario exits non-zero.
- iPhone Safari tabs cannot subscribe — UI shows **add to home** instead.
- **Headless CDP cannot prove push** — `push-notify` always uses headed Chrome. Other scenarios stay headless.
- If the notify button stays on `…` in headed mode, click **Allow** on the Chrome notification permission prompt on the desktop.
