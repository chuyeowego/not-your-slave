# Conversation log

The left `#chat` pane is the user-facing conversation log. It paints `heard` / `said` / `woke` rows from `/api/mindlog` (not the live event stream).

## Sub-features

- `log-user` — `heard` rows render as `.msg.me` ("you").
- `log-agent` — `said` rows render as `.msg.it` ("it"); needs AI credential for live reply.
- `log-woke` — heartbeat turns show a `.woke` divider.
- `log-earlier` — **load earlier** pages with `?before=`.

## How to get to it (user POV)

Open `/`. The chat column is on the left. Send a message or wait for a wake — bubbles accumulate there.

## Driving it with verify-nys

Preconditions: `doctor` passes.

```bash
verify-nys drive conversation-log
```

- Sends a unique marker by typing into `#input` and clicking **Send**.
- Waits for a `heard` mindlog entry with that text.
- Asserts `#chat .msg.me` contains the marker.
- Captures `conversation-log.png` + `result.json`.

Proof: `heard` in `/api/mindlog` **and** matching text in `#chat .msg.me`.

## Gotchas

- Without AI credential, agent may add an `it` error bubble after the model call; the user message proof is still the `heard` row + `.msg.me`.
- `thought` / `did` never appear in the chat — mindlog only.
- `#status` stays `loading` until `restore()` finishes after reload.
