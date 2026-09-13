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

Preconditions:

- `verify-nys doctor` passes.
- `AI_GATEWAY_API_KEY` or linked Vercel OIDC for a full think cycle (optional for queue proof only).

- **Trigger.** `verify-nys api POST /api/think` → `{"sessionId":"..."}`.
- **UI mirror.** In browser, `#think` shows `waking` then returns to **Wake it**.
- **Mindlog row.** Poll `verify-nys api GET '/api/mindlog?limit=20'` for `kind":"woke"` after the heartbeat prompt prefix (see `HEARTBEAT` in `agent/schedules/think.ts`).
- **Proof.** `verify-nys capture wake-it trigger` after `woke` appears.

## Gotchas

- Without AI credentials the session may be created but no `thought`/`said` follows — `woke` alone can still prove the button/API path.
- Heartbeat `woke` entries do **not** send Web Push (only `said` does).
- Do not spam `/api/think`; each queues a full agent turn on the shared `timeline` session.
