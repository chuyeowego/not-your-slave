# Photo persists

An attached image must survive reload: `heard` rows store `images[].data` as `data:image/...;base64,...`, and `paintEntry` passes them back into `bubble()` on restore.

## Sub-features

- `photo-attach` — **Attach** / paste / drop → `#files` + `#previews`.
- `photo-send` — `multipart/form-data` to `POST /api/say`.
- `photo-restore` — `#chat .msg.me img.pic` from stored `entry.images`.

## How to get to it (user POV)

Click **Attach**, pick an image, optionally caption, **Send**, reload — the thumbnail should still show in your message.

## Driving it with verify-nys

```bash
verify-nys drive photo-persist
```

Uses `lib/fixtures.mjs` `pngFixture()` written to the evidence dir (no binary in git).

- Attaches via `DOM.setFileInputFiles` on `#files`.
- Sends with caption; asserts `img.pic` before reload.
- Asserts mindlog `heard.images[0].data` is inline base64.
- Reloads; asserts `img.pic` and caption still present.

Proof: `before-reload.png`, `after-reload.png`, `result.json`. **Tier A:** `#mindlog img.pic` after reload. **Tier B:** `#chat .msg.me img.pic` after reload.

## Gotchas

- Same session-restore rule as text-persist: chat-column photo reload needs tier B.

- Blob URLs on first paint are not persistence proof — always assert `/api/mindlog` and post-reload DOM.
- Caption `(image)` is hidden in the UI when only a photo is sent; this scenario includes a real caption.
- Images over 3 MiB degrade to path references — stay under `SAY.maxBytes`.
