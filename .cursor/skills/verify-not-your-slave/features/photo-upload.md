# Attach a photo

Show the agent a picture. The bytes have to reach the model as pixels, not as a filename or a URL it cannot fetch.

## Sub-features

- Attach via the file picker (`Attach` button → hidden `#files` input).
- Attach via paste into the composer, and via drag-and-drop on `#composer` or `#chat` (not the full page).
- Thumbnail previews before sending, each with a remove control.
- Caps: jpeg / png / webp / gif, at most 4 images, 3 MiB each. The page enforces them and `POST /api/say` enforces them again.
- A caption is optional. A photo with no caption still sends, and the synthetic `(image)` caption is hidden wherever the picture itself is shown.
- The photo persists: the `heard` mindlog entry stores a `data:` URL, so the mindlog pane and `/entry/:key` render it later.
- A failed send shows an `[error]` bubble instead of leaving the status on `thinking`.

## How to get to it (user POV)

Open `/`. Click **Attach** and pick an image (or paste one into the text box, or drop one on the composer or chat). A thumbnail appears above the input. Type a caption if you want one, then **Send** (or Cmd/Ctrl+Enter). The photo appears in your message on the left, and as a thumbnail in the mindlog on the right.

## Driving it with verify-nys

```bash
verify-nys drive send-photo
verify-nys drive say-limits
```

`send-photo` attaches a real PNG through `DOM.setFileInputFiles` on `#files`, clicks submit, and asserts `heard.images[0].data` starts with `data:image/`. `say-limits` hits the HTTP contract for wrong type, oversize, and count caps.

Proof: `evidence/send-photo/<run-id>/` and `evidence/say-limits/<run-id>/` including **`proof.html`**.

## Gotchas

- The chat bubble paints from a local blob URL on send and from the stored `data:` URL on restore. Asserting only on the live bubble proves nothing about persistence — always assert against `/api/mindlog` too.
- 3 MiB is eve's ceiling for restoring an attachment as vision bytes. Above it eve degrades the part to a text path reference.
- `POST /api/say` accepts multipart (page) and JSON base64 (`say-limits`); both use `parseSay`.
