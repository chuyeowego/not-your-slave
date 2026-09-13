# Text persists

A text message sent from the composer must survive a full page reload, restored from the mindlog via `GET /api/session` + `conversationPage()`.

## Sub-features

- `text-send` — **Send** or Cmd/Ctrl+Enter submits `#input`.
- `text-heard` — `mindlog-capture` writes `kind: heard` with the text.
- `text-restore` — reload calls `restore()` which repaints spoken kinds from `/api/mindlog`.

## How to get to it (user POV)

Type in the box at the bottom left, press **Send**, then reload the browser tab. Your message should still appear under "you".

## Driving it with verify-nys

```bash
verify-nys drive text-persist
```

- Types a unique marker, clicks the real submit button.
- Screenshots before reload; asserts `heard` in mindlog.
- `location.reload()`; waits for `#chat .msg.me` to contain the marker again.
- Asserts `sessionId` is non-null after reload.

Proof: `before-reload.png`, `after-reload.png`, `result.json`. **Tier A:** mindlog pane + `/api/mindlog` after reload. **Tier B:** `#chat .msg.me` after reload too.

## Gotchas

- Left-pane reload restore needs a resolvable session (`GET /api/session` not null). Failed model turns at tier A clear the session, so chat reload proof needs `AI_GATEWAY_API_KEY` in `.env.local`.
- Right-pane mindlog reload works at tier A (polls `/api/mindlog` without a session).
- Empty submits are ignored client-side — use a non-empty marker.
- Do not assert only on the optimistic bubble before `heard` lands.
