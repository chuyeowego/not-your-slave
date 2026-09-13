# Attach a photo

Show the agent a picture. The bytes have to reach the model as pixels, not as a
filename or a URL it cannot fetch.

## Sub-features

- Attach via the file picker (`Attach` button → hidden `#files` input).
- Attach via paste into the composer, and via drag-and-drop onto the page.
- Thumbnail previews before sending, each with a remove control.
- Caps: jpeg / png / webp / gif, at most 4 images, 3 MiB each. The page enforces
  them and `POST /api/say` enforces them again.
- A caption is optional. A photo with no caption still sends, and the synthetic
  `(image)` caption is hidden wherever the picture itself is shown.
- The photo persists: the `heard` mindlog entry stores a `data:` URL, so the
  mindlog pane and `/entry/:key` render it later.
- A failed send shows an `[error]` bubble instead of leaving the status on
  `thinking`.

## How to get to it (user POV)

Open `/`. Click **Attach** and pick an image (or paste one into the text box, or
drop one anywhere on the page). A thumbnail appears above the input. Type a
caption if you want one, then **Send** (or Cmd/Ctrl+Enter). The photo appears in
your message on the left, and as a thumbnail in the mindlog on the right.

## Driving it with the CDP harness

```sh
node bin/drive.mjs send-photo --port 2999 --run-dir /tmp/nys-verify/<run>
node bin/drive.mjs say-limits --port 2999 --run-dir /tmp/nys-verify/<run>
```

`send-photo` attaches a real PNG through `DOM.setFileInputFiles` on `#files` —
the same path the file picker uses — then clicks the real submit button. Stable
handles: `#composer`, `#files`, `#previews img`, `#chat .msg.me img.pic`,
`#mindlog img.pic`, `#mindlog-open`.

The end state that proves it: a `heard` entry from `GET /api/mindlog` whose
`images[0].data` starts with `data:image/`. That is the agent's own memory
holding the pixels, which is the thing a filename in the chat DOM would fake.

## Gotchas

- The chat bubble paints from a local blob URL on send and from the stored
  `data:` URL on restore. Asserting only on the live bubble proves nothing about
  persistence — always assert against `/api/mindlog` too.
- 3 MiB is eve's ceiling for restoring an attachment as vision bytes, not an
  arbitrary limit. Above it eve degrades the part to a text path reference, and
  the model stops seeing the picture.
- Eve stages every upload into `/workspace/attachments/<sha>/<name>` and labels
  the file part with that path. `agent/agent.ts` strips that filename and adds a
  look-at-this reminder on image turns, because the path alone pushes a coding
  model into shelling out to OpenCV. Verifying that behavior needs tier B.
- `POST /api/say` takes both `multipart/form-data` (what the page sends) and
  JSON with base64 or `data:` payloads (what `say-limits` uses). Both go through
  the same `parseSay`, so either is a fair test of the limits.
