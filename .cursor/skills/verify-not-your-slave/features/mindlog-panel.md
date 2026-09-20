# Mindlog panel

The mindlog panel shows the agent's append-only log (kinds: `woke`, `heard`, `thought`, `said`, `did`, `note`) in the right column. On narrow viewports it opens via the **mindlog** button.

## Sub-features

- `mindlog-poll` refreshes every ~3s via `GET /api/mindlog` with ETag/`304` support.
- `mindlog-entry-link` timestamps link to `/entry/<id>`.
- `mindlog-mobile-drawer` opens/closes with **mindlog** / **close**.

## How to get to it (user POV)

- Desktop: visible in the right pane labeled **mindlog**.
- Mobile (`max-width: 800px`): tap **mindlog** in the chat header; close with **close**.

## Driving it with verify-nys

```bash
verify-nys drive mindlog-panel
```

Seeds a `note`, asserts `GET /api/mindlog`, confirms `#mindlog` + `#think` on `/`. Proof: `evidence/mindlog-panel/<run-id>/` including **`proof.html`**.

## Gotchas

- Empty store returns `{"entries":[]}` — seed or chat before asserting rows.
- API `entries` are chronological (oldest first); the UI treats the last row as newest.
- Polling uses `If-None-Match`; repeated identical reads may return `304` with empty body — use first fetch or drop the header.
- Chat history in the left pane filters to `heard` / `said` / `woke`; tool `note` rows appear only in the mindlog panel unless spoken kinds.
- Postgres mode (`DATABASE_URL`) ignores `MINDLOG_FILE`; verification runs should omit `DATABASE_URL` to stay file-backed.
