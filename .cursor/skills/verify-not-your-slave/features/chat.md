# Chat

Chat lets a user type in the left-hand composer and send a message to the persistent agent. The page streams the reply and the mindlog records `heard` (user) and `said` (agent).

## Sub-features

- `chat-send` submits non-empty text via **Send** or Cmd/Ctrl+Enter.
- `chat-stream` attaches to `/eve/v1/session/<id>/stream` after first send.
- `chat-reject-empty` ignores blank submits.

## How to get to it (user POV)

- Open `http://127.0.0.1:2000/` (or the launched `$BASE_URL`).
- Focus the textarea under the **an agent that thinks for itself** header.
- Type a message and click **Send** or press Cmd/Ctrl+Enter.

## Driving it with verify-nys

Preconditions:

- `verify-nys doctor` passes.
- `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` in `.env.local` (otherwise the agent cannot reply).

- **Load page.** `curl -fsS $BASE_URL/` → HTML contains `id="input"` and button text `Send`.
- **Send via API (same path as UI).** `verify-nys api POST /api/say '{"message":"verification hello"}'` → `{"ok":true,"sessionId":"..."}`.
- **Confirm session.** `verify-nys api GET /api/session` → `sessionId` matches prior response.
- **Wait for mindlog.** Poll `verify-nys api GET '/api/mindlog?limit=10'` until an entry with `kind":"heard"` and text `verification hello` appears (agent `said` may follow).
- **Proof.** `verify-nys capture chat send` → `evidence/chat/<run-id>/send.json` lists the `heard` entry.

## Gotchas

- `eve dev` does not run hourly cron; chat is the usual way to get a first `sessionId`.
- Without AI credentials, `POST /api/say` may accept the message but the agent will not complete — do not treat HTTP 200 alone as proof.
- `#status` shows `thinking` during a turn; poll mindlog rather than fixed sleeps.
- Production hosts require HTTP Basic (`AGENT_USER` / `AGENT_PASS`); localhost under `eve dev` does not.
