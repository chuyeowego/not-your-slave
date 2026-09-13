# Install and notify

The page is a PWA, and a completed reply can reach a subscribed device through
Web Push while the window is closed.

## Sub-features

- `GET /manifest.webmanifest`, `GET /sw.js`, `GET /icon.svg`, `/icon-192.png`,
  `/icon-512.png` — all unguarded, so a browser can install without replaying
  Basic auth.
- **Notify** asks for permission on a tap, never on first paint, then subscribes
  and sends one test notification.
- `GET /api/push/vapid` reports the public key, or 503 `no vapid` when the keys
  are absent.
- `POST /api/push/subscribe` stores a subscription; `POST /api/push/test` sends
  a forced notification.
- A new `said` entry fans out to stored subscriptions. `woke` entries do not.
- The service worker suppresses the banner on a focused window of that device.

## How to get to it (user POV)

Open `/`, click **Notify** in the header, accept the browser prompt. A test
notification arrives immediately. On iPhone this only works after **Add to Home
Screen**; the UI says so rather than pretending.

## Driving it with the CDP harness

No scenario yet. The installable assets are plain HTTP and need no browser:

```sh
for path in /manifest.webmanifest /sw.js /icon.svg /icon-192.png /icon-512.png; do
  curl -sS -o /dev/null -w "$path %{http_code} %{content_type}\n" "http://127.0.0.1:2999$path"
done
curl -sS http://127.0.0.1:2999/api/push/vapid
```

Stable handles for the button path: `#notify`.

The end state that proves it: each asset returns 200 with its declared content
type, `/sw.js` carries `service-worker-allowed: /`, and `/api/push/vapid`
returns either a public key or an honest 503.

## Gotchas

- Without `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` the whole push half is
  expected to report `no vapid`. That is a pass for an unconfigured instance.
- Headless Chrome will not grant a real notification permission prompt, and
  push delivery needs a live push service. Verify the HTTP contract and the
  subscription store; do not try to assert a banner appeared.
- These routes are deliberately outside the auth guard. If a change starts
  requiring auth on them, installation breaks — that is worth a check.
