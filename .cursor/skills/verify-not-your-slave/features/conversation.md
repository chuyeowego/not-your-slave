# Say something and get a reply

The left pane. One durable session shared with the heartbeat, so a human
message and a self-prompted thought land in the same conversation.

## Sub-features

- Send text with the **Send** button or Cmd/Ctrl+Enter.
- The reply streams in character by character under an `it` label.
- `woke` markers separate heartbeat turns from answers to you.
- History is restored on load from the mindlog, not from the event stream.
- **load earlier** pages further back through `/api/mindlog?before=`.
- The status chip in the header moves between `idle`, `thinking`, and `error`.
- A message sent while the agent is mid-turn steers it; a heartbeat arriving
  mid-turn queues instead (`agent/schedules/think.ts`).

## How to get to it (user POV)

Open `/`, type in the box at the bottom left, press **Send**. Watch the reply
appear under `it`. Reload the page: the conversation should still be there.

## Driving it with the CDP harness

No scenario yet. The shape to write:

```js
await page.goto(ctx.baseUrl);
await page.evaluate(`document.getElementById("input").value = "hello"`);
await page.evaluate(`document.querySelector("#composer button[type=submit]").click()`);
await page.waitFor('document.querySelectorAll("#chat .msg.it").length >= 1', { timeoutMs: 60000 });
```

Stable handles: `#input`, `#composer button[type=submit]`, `#chat .msg.me`,
`#chat .msg.it`, `#status`, `#earlier`, `.woke`.

The end state that proves it: a `said` entry in `/api/mindlog` whose text
matches what the chat pane rendered. The DOM alone can show a stream that was
never recorded.

## Gotchas

- Needs tier B. Without a model credential the turn dies at the model call and
  the only `it` bubble is `[AI Gateway received no credentials.]`.
- Reload-restore depends on `GET /api/session` returning an id; `ensureSession`
  in `agent/lib/page.ts` calls `restore()` only then. A session whose first turn
  failed never becomes resolvable, so an empty chat pane after reload is
  expected at tier A and a real failure at tier B.
- The page polls every 3 seconds and only while the tab is visible. Headless
  Chrome reports visible, but do not wait on a poll you can trigger directly.
- `restore()` paints only `heard`, `said`, and `woke` kinds. `thought` and `did`
  are mindlog-only by design — their absence from the chat is not a bug.
