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

Preconditions:

- `verify-nys doctor` passes.
- At least one mindlog row exists (use `verify-nys seed-note "verification probe"` when AI is unavailable).

- **Seed (scaffolding).** `verify-nys seed-note "verification probe"` → prints entry id hex.
- **Read API.** `verify-nys api GET '/api/mindlog?limit=5'` → JSON `entries` array newest-first; newest `kind` is `note` with text `verification probe`.
- **Confirm page shell.** `curl -fsS $BASE_URL/` → contains `id="mindlog"` and **Wake it** button (`#think`).
- **Proof.** `verify-nys capture mindlog-panel proof` → `evidence/mindlog-panel/<run-id>/proof.json` includes the seeded note; `proof-home.html` includes mindlog markup hooks.

## Gotchas

- Empty store returns `{"entries":[]}` — seed or chat before asserting rows.
- Polling uses `If-None-Match`; repeated identical reads may return `304` with empty body — use first fetch or drop the header.
- Chat history in the left pane filters to `heard` / `said` / `woke`; tool `note` rows appear only in the mindlog panel unless spoken kinds.
- Postgres mode (`DATABASE_URL`) ignores `MINDLOG_FILE`; verification runs should omit `DATABASE_URL` to stay file-backed.
