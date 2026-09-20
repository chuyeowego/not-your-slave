# PWA install assets

Installable web app metadata: manifest, icons, and a service worker with push handlers. These routes are **public** (no Basic auth) so browsers can install without credentials.

## Sub-features

- `pwa-manifest` serves `application/manifest+json` at `/manifest.webmanifest`.
- `pwa-icons` serves `/icon.svg`, `/icon-192.png`, `/icon-512.png`.
- `pwa-sw` registers `/sw.js` with push + notification click handlers.

## How to get to it (user POV)

- Browser install prompt uses `/manifest.webmanifest` (linked from `<link rel="manifest">` on `/`).
- Service worker registers automatically on page load (`navigator.serviceWorker.register("/sw.js")`).

## Driving it with verify-nys

```bash
verify-nys drive pwa-install
```

Fetches `/manifest.webmanifest` (GET + HEAD), `/sw.js` (push handler + `showNotification`), `/icon-192.png` (PNG magic). Writes artifacts under `evidence/pwa-install/<run-id>/` plus **`proof.html`**.

## Gotchas

- Web Push delivery is **not** proven by manifest/SW fetch — see [Push notifications](./push-notifications.md) (`push-notify`, needs VAPID).
- `VAPID_SUBJECT` must not use `@localhost` (Safari rejects with `403 BadJwtToken`).
