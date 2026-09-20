# Chat

Chat lets a user type in the left-hand composer and send a message to the persistent agent. The page streams the reply and the mindlog records `heard` (user) and `said` (agent).

## Sub-features

- `chat-send` submits non-empty text via **Send** or Cmd/Ctrl+Enter.
- `chat-reject-empty` ignores blank submits.

## How to get to it (user POV)

- Open `http://127.0.0.1:2000/` (or the launched `$BASE_URL`).
- Focus the textarea under the **an agent that thinks for itself** header.
- Type a message and click **Send** or press Cmd/Ctrl+Enter.

## Driving it with verify-nys

```bash
verify-nys drive chat
```

`POST /api/say`, poll mindlog for `heard`, assert `/api/session` has `sessionId`. Agent `said` is not in this scenario — that is AI-gated on `wake-it`.

Proof: `evidence/chat/<run-id>/` including **`proof.html`**.

## Gotchas

- `eve dev` does not run hourly cron; chat is the usual way to get a first `sessionId`.
- Without AI credentials, `POST /api/say` may accept the message but the agent will not complete — do not treat HTTP 200 alone as proof.
- `#status` shows `thinking` during a turn; poll mindlog rather than fixed sleeps.
- Production hosts require HTTP Basic (`AGENT_USER` / `AGENT_PASS`); localhost under `eve dev` does not.
