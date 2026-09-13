# Photo persists

An attached image must survive reload: `heard` rows store `images[].data` as `data:image/...;base64,...`, and `paintEntry` passes them back into `bubble()` on restore.

## Sub-features

- `photo-attach` — **Attach** / paste / drop → `#files` + `#previews`.
- `photo-send` — `multipart/form-data` to `POST /api/say`.
- `photo-restore` — `#chat .msg.me img.pic` from stored `entry.images`.

## How to get to it (user POV)

Click **Attach**, pick an image, optionally caption, **Send**, reload — the thumbnail should still show in your message.

## Driving it with verify-nys

**Requires image upload product** ([PR #25](https://github.com/chuyeowego/not-your-slave/pull/25)) — scenario fails against bare `main`.

```bash
verify-nys drive photo-persist
```

Uses `lib/fixtures.mjs` `pngFixture()` written to the evidence dir (no binary in git).

- Attaches via `DOM.setFileInputFiles` on `#files`.
- Sends with caption; asserts `img.pic` before reload.
- Asserts mindlog `heard.images[0].data` is inline base64.
- Reloads; asserts `#mindlog img.pic` always; `#chat .msg.me img.pic` when AI credential present (else **blocked**).

Proof: `before-reload.png`, `after-reload.png`, `result.json`, **`proof.html`**.

## Gotchas

- Same `#chat` restore rule as text-persist — needs AI credential or check is blocked.
- Blob URLs on first paint are not persistence proof — always assert `/api/mindlog` and post-reload DOM.
- Images over 3 MiB degrade to path references — stay under `SAY.maxBytes`.
