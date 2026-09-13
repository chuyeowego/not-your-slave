# Wake it

**Wake it** queues a manual heartbeat (`POST /api/think`) because `eve dev` never fires the hourly cron schedule. The mindlog should gain a `woke` entry and the agent may think aloud.

## Sub-features

- `wake-button` sets **Wake it** → `waking` for ~4s.
- `wake-queue` uses `turnPolicy: "queue"` so an in-flight reply is not cancelled.
- `wake-mindlog` records `woke` via `mindlog-capture` hook.

## How to get to it (user POV)

- Open the home page.
- In the **mindlog** header (right pane / drawer), click **Wake it**.

## Driving it with verify-nys

```bash
verify-nys drive wake-it
```

- `POST /api/think` returns a `sessionId`.
- Waits for `kind: woke` in `/api/mindlog`.
- Clicks `#think` in headless Chrome; asserts `#chat .woke` divider appears.
- **Tier B:** also waits for a `said` entry (live model reply).
- **Tier A:** `woke` + divider is sufficient.

Proof: `wake-it.png`, `result.json`.

## Gotchas

- Without AI credentials (tier A) the `woke` path still works; do not require `said`.
- Heartbeat `woke` entries do **not** send Web Push (only `said` does).
- Do not spam `/api/think`; each queues a full agent turn on the shared `timeline` session.
