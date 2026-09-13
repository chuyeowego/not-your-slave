# Push notifications

Web Push: **Notify** requests permission, subscribes via `/api/push/subscribe`, and `/api/push/test` sends a forced notification. Completed `said` entries also fan out when configured.

## Sub-features

- `push-vapid` — `GET /api/push/vapid` returns the public key or honest 503.
- `push-subscribe` — stores subscription in `PUSH_FILE` or Postgres.
- `push-test` — `POST /api/push/test` delivers `"push is on"`.
- `push-said-fanout` — automatic on new `said` (tier B; not covered by `push-notify` scenario).

## How to get to it (user POV)

Open `/`, click **notify**, accept the browser prompt. Button should read **test push** and a notification arrives.

## Driving it with verify-nys

Preconditions:

- `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `.env.local` (generate with `npx web-push generate-vapid-keys`).
- Optional `VAPID_SUBJECT=mailto:you@example.com` (never `@localhost`).

```bash
verify-nys drive push-notify
```

- Grants notification permission via CDP.
- Clicks `#notify`; expects button **test push**.
- Asserts a push subscription exists in the browser.
- `POST /api/push/test` returns `sent >= 1`.

Proof: `vapid.json`, `subscription.json`, `push-test.json`, `notify.png`.

## Gotchas

- **Blocked without VAPID** — scenario fails fast with a clear check; not a skip.
- iPhone Safari tabs cannot subscribe — UI shows **add to home** instead.
- Headless Chrome needs `Browser.grantPermissions` for notifications; if delivery still fails, check VAPID subject and subscription endpoint reachability.
