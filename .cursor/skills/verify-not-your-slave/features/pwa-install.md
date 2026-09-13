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

Preconditions:

- `verify-nys doctor` passes (or any server on `$BASE_URL`).

- **Manifest.** `curl -fsS $BASE_URL/manifest.webmanifest` → JSON `display:"standalone"`, `start_url:"/"`, `name` contains `agent`.
- **HEAD probe.** `curl -fsSI $BASE_URL/manifest.webmanifest` → `200` (install checks use HEAD).
- **Service worker.** `curl -fsS $BASE_URL/sw.js` → contains `addEventListener("push"` and `showNotification`.
- **Icon.** `curl -fsS $BASE_URL/icon-192.png | head -c 4 | xxd` → PNG magic `8950 4e47`.
- **Proof.** `verify-nys capture pwa-install manifest` or save manifest JSON under `evidence/pwa-install/<run-id>/`.

## Gotchas

- Web Push delivery is **not** proven by manifest/SW fetch — see **notify** / `POST /api/push/test` (needs VAPID).
- iPhone requires Add to Home Screen before push; UI shows **add to home** in Safari tab.
- `VAPID_SUBJECT` must not use `@localhost` (Safari rejects with `403 BadJwtToken`).
