# Wake it by hand

The agent wakes itself hourly in production. Locally nothing fires cron, so the
**Wake it** button is how you watch it think without waiting.

## Sub-features

- **Wake it** posts `/api/think`, which sends the `HEARTBEAT` prompt to the same
  TIMELINE session a human message uses.
- The button disables itself and reads `waking`, then resets after 4 seconds.
- A heartbeat is queued, not steered: it waits for a turn in progress instead of
  cutting off a reply to a human.
- The turn is recorded as `woke` in the mindlog and marked with a `woke` divider
  in the chat, because what it says on waking is visible to whoever is watching.
- In production the same send comes from the `0 * * * *` schedule.

## How to get to it (user POV)

Open `/`, find **Wake it** in the mindlog pane's header, click it. A `woke`
divider appears in the conversation and the agent starts thinking out loud.

## Driving it with the CDP harness

No scenario yet. The shape to write:

```js
await page.evaluate(`document.getElementById("think").click()`);
await page.waitFor('document.querySelectorAll("#chat .woke").length >= 1', { timeoutMs: 60000 });
```

Or skip the page entirely: `curl -X POST http://127.0.0.1:<port>/api/think`.

Stable handles: `#think`, `#chat .woke`, `#mindlog .entry[data-kind=woke]`.

The end state that proves it: a `woke` entry in `/api/mindlog` followed by a
`said` entry from the same `sessionId`.

## Gotchas

- Needs tier B for anything past the `woke` entry.
- `mindlog-capture.ts` decides `woke` versus `heard` by comparing the incoming
  text against the `HEARTBEAT` constant, because both arrive at the same
  address. Changing that prompt's wording changes the classification — if manual
  wakes start logging as `heard`, look there first.
- Do not fire two wakes in quick succession expecting two turns. The second one
  queues behind the first and can look like a hang.
