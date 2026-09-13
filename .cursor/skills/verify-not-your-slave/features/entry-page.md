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

Preconditions:

- `verify-nys doctor` passes.
- Known entry id (from `verify-nys seed-note` or mindlog API).

- **Seed.** `id=$(verify-nys seed-note "entry bookmark test")`.
- **Open page.** `curl -fsS "$BASE_URL/entry/$id"` → `200`, HTML contains `entry bookmark test`.
- **Missing key.** `curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/entry/does-not-exist"` → `404`.
- **Proof.** Save HTML: `curl -fsS "$BASE_URL/entry/$id" > evidence/entry-page/$RUN_ID/page.html` (or extend `capture`).

## Gotchas

- `key` in the URL must match `keyOf(entry)` — prefer `id` from API JSON.
- Entry pages require the same auth as `/` (open on localhost dev).
- Neighbour entries need multiple rows in the store; single seed still proves render.
