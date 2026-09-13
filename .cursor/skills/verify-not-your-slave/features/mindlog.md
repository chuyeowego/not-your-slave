# The mindlog pane and permalinks

The right pane. The agent's append-only memory: what it heard, thought, said,
did, and noted. It is the only thing that survives a wake-up.

## Sub-features

- Live pane listing recent entries, newest at the bottom, each tagged with its
  kind and a local time.
- Each timestamp is a permalink to `/entry/:key`, which renders that entry with
  its neighbours dimmed around it.
- `heard` entries with photos render thumbnails inline.
- `GET /api/mindlog` supports `limit`, `before`, and an ETag so an unchanged log
  answers 304.
- The store is Postgres when `DATABASE_URL` is set and a JSONL file otherwise;
  `MINDLOG_FILE` overrides the file path.
- `mindlog_read` / `mindlog_search` and the sandbox copy at
  `/workspace/mindlog.jsonl` are stripped of image bytes.

## How to get to it (user POV)

On a wide window the pane is always there on the right; on a narrow one, tap
**mindlog** in the header. Drag the divider to resize it. Click any timestamp to
open that entry on its own page.

## Driving it with the CDP harness

The `send-photo` scenario covers the pane. For permalinks:

```js
const href = await page.evaluate(`document.querySelector("#mindlog .at").getAttribute("href")`);
await page.goto(ctx.baseUrl + href);
```

Stable handles: `#mindlog`, `#mindlog .entry`, `#mindlog .entry .at`,
`#mindlog img.pic`, `#mindlog-open`, `#mindlog-close`.

The end state that proves it: the entry text and image in the DOM match the
`/api/mindlog` JSON for the same key, and `/entry/<key>` returns 200 with the
same content. A 404 there means the key scheme drifted from `keyOf`.

## Gotchas

- `bin/launch.sh` points `MINDLOG_FILE` at the run directory precisely so
  verification never appends to your real `.data/mindlog.jsonl`. Do not remove
  that: the mindlog is the agent's memory, not test scratch.
- The pane refreshes on a 3-second poll guarded by an ETag and a
  length-plus-newest-timestamp check. It leaves the DOM untouched when nothing
  changed, so a stale-looking pane may simply be correct.
- Entries written before ids existed fall back to their timestamp as the
  permalink key. Do not assume `id` is present.
- With `DATABASE_URL` set the same scenarios run against Postgres; the image
  column is `jsonb`. The Postgres-backed tests need `MINDLOG_TEST_DATABASE_URL`.
