# Text persists

A text message sent from the composer must survive a full page reload. The mindlog pane always polls `/api/mindlog`. The left `#chat` pane repaints spoken rows via `restore()` → `conversationPage()`, but **`ensureSession()` only calls `restore()` when `/api/session` returns a non-null `sessionId`** (`agent/lib/page.ts`).

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
- Screenshots before/after reload; records `sessionId` before and after reload in `result.json` meta.
- `location.reload()`; soft-waits for mindlog pane and `#chat` — **timeouts record FAIL and the scenario continues**.
- `#chat` user restore is asserted when `/api/session` has an id after send (`restore()` from mindlog — not AI-gated).
- Asserts `heard` in `/api/mindlog`.

Proof: `before-reload.png`, `after-reload.png`, `result.json`, **`proof.html`**. Rollup: `evidence/_runs/<run-id>/proof.html`.

## Gotchas

- `#chat` user restore is `restore()` from `/api/mindlog` spoken rows once `/api/session` has an id. AI is not on that path — gate AI only for agent `said`/`thought`.
- `sessionId` null at `doctor` before any send is normal.
- Right-pane mindlog reload works without a session (polls `/api/mindlog`).
- Empty submits are ignored client-side — use a non-empty marker.
