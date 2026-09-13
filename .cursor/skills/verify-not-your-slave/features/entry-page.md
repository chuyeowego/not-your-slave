# Entry page

Each mindlog timestamp links to `/entry/<key>` — a bookmarkable page showing one entry with neighbours dimmed. Keys are entry `id` or legacy `at` timestamp.

## Sub-features

- `entry-render` shows kind, time, and markdown body.
- `entry-404` returns plain `No such entry.` for unknown keys.
- `entry-copy-link` copies the permalink (button on entry page).

## How to get to it (user POV)

- On the home page mindlog panel, click a timestamp link in any `.entry` row.
- Or navigate directly to `/entry/<id>`.

## Driving it with verify-nys

```bash
verify-nys drive entry-page
```

Seeds a `note`, `GET /entry/:id` (200 + body text), 404 for a missing key. Writes `entry.html` under `evidence/entry-page/<run-id>/` plus **`proof.html`**.

## Gotchas

- `key` in the URL must match `keyOf(entry)` — prefer `id` from API JSON.
- Entry pages require the same auth as `/` (open on localhost dev).
- Neighbour entries need multiple rows in the store; single seed still proves render.
