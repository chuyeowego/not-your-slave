# Feature map — not-your-slave

What a person can actually do with this app, and what proves each one works.
This is the maintained source for verification: a proof that drives only the
convenient entry point is incomplete when a feature file lists others.

The app is one page (chat left, mindlog right) backed by one durable eve
session. Everything below is reachable from `http://127.0.0.1:<port>/`.

| Feature | File | Scenario | Needs a model credential |
| --- | --- | --- | --- |
| Say something and get a reply | [conversation.md](conversation.md) | — | yes, for the reply |
| Attach a photo | [photo-upload.md](photo-upload.md) | `send-photo`, `say-limits` | no, up to the model call |
| The mindlog pane and permalinks | [mindlog.md](mindlog.md) | `send-photo` (pane only) | no |
| Wake it by hand | [heartbeat.md](heartbeat.md) | — | yes, to produce a `woke` reply |
| Install and notify | [install-and-push.md](install-and-push.md) | — | no (needs VAPID keys) |

## Tiers

`bin/doctor.sh` prints which tier the running instance can prove.

- **Tier A — no `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN`.** Everything up to
  the model call: the page, the composer, `POST /api/say` and its limits, the
  `heard` mindlog entry with image bytes, the mindlog pane, the error bubble.
  The turn ends with `[AI Gateway received no credentials.]` in the window, and
  that is a pass for tier A, not a failure.
- **Tier B — credential present.** Adds the agent's reply: `thought`, `said`
  and `did` entries, streaming into the chat pane, and whether the model
  actually looked at an attached photo instead of trying to parse it.

## Coverage gaps worth knowing

- **Chat history after reload** is restored only when `GET /api/session`
  resolves a session (`agent/lib/page.ts`, `ensureSession`). A tier-A turn dies
  before the session becomes resolvable, so the chat pane is empty on reload
  while the mindlog pane still shows the photo. Verify restore at tier B.
- **Paste and drag-drop** attachment paths are not scripted yet; only the file
  picker is. They share `addFiles()` in `agent/lib/page.ts`, but sharing code is
  not evidence.
- **The sandbox is stubbed** by default (`--sandbox just-bash`), so anything
  about the agent running real commands in `/workspace` is out of scope for
  this harness. Relaunch with `--sandbox real` on a machine with Docker or
  working KVM to cover it.
