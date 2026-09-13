# Verification evidence (local only)

Proof artifacts are **not committed**. Generate them on your machine after a launch:

```bash
H=.cursor/skills/verify-not-your-slave/helpers/verify-nys
$H launch --port 2000 --run-id my-proof
$H doctor
$H drive conversation-log
# …more scenarios…
```

Each `drive` writes:

- `evidence/<scenario>/<run-id>/result.json` — pass / fail / blocked checks
- `evidence/<scenario>/<run-id>/proof.html` — human skim (from `lib/proof-index.mjs`)
- `evidence/<scenario>/<run-id>/*.png` — screenshots when captured

Rollup for one launch: `evidence/_runs/<run-id>/proof.html`.

`verify-nys cleanup` keeps this tree; only `.run/` ephemeral state is removed.
