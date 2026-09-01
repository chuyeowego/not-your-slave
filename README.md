# not-your-slave

A persistent agent, in the spirit of [headlong](https://www.laude.org/updates/headlong-a-microharness-for-persistent-agents),
built on [eve](https://eve.dev).

It is not a chatbot. It wakes itself on a heartbeat, keeps its own thread of
thought between the moments you are present, and writes everything it hears,
thinks, says, and does to an append-only **mindlog**. The mindlog is its only
continuity: each wake-up starts by reading it.

## Run it

```bash
npm run dev          # http://127.0.0.1:2000 – chat left, mindlog right
```

`eve dev` never fires cron, so use the **Wake it** button to trigger a heartbeat
by hand. For real autonomy, run the built server, which starts the scheduler:

```bash
npm run build && npm start
```

## Understanding it

`docs/explainers/` has one interactive page per commit: background, the core
intuition with diagrams, a code walkthrough, and five questions to check you
followed it. Each links to its commit on GitHub. Open them in order:

| Page | Commit |
| --- | --- |
| `01-scaffold.html` | [`e07b253`](https://github.com/chuyeowego/not-your-slave/commit/e07b253) scaffold an eve agent on cheap open weights |
| `02-mindlog.html` | [`7850d7c`](https://github.com/chuyeowego/not-your-slave/commit/7850d7c) the mindlog |
| `03-capture.html` | [`4be5d7e`](https://github.com/chuyeowego/not-your-slave/commit/4be5d7e) automatic capture |
| `04-heartbeat.html` | [`24cb9f6`](https://github.com/chuyeowego/not-your-slave/commit/24cb9f6) the heartbeat |
| `05-web-ui.html` | [`5d117e6`](https://github.com/chuyeowego/not-your-slave/commit/5d117e6) the web interface |
| `06-persistence.html` | [`054ea75`](https://github.com/chuyeowego/not-your-slave/commit/054ea75) workspace sync and search |

## What is where

| Path | What |
| --- | --- |
| `agent/instructions.md` | who it is, and how it treats the mindlog |
| `agent/lib/mindlog.ts` | the mindlog store (JSONL at `.data/mindlog.jsonl`) |
| `agent/hooks/mindlog-capture.ts` | automatic capture: woke / heard / thought / said / did |
| `agent/hooks/workspace-sync.ts` | keeps `/workspace` across sessions, and drops a readable mindlog copy in it |
| `agent/tools/mindlog_{append,read,search}.ts` | deliberate notes, recent recall, and search over the whole log |
| `agent/schedules/think.ts` | the heartbeat, every 15 minutes |
| `agent/channels/home.ts` | the page, `/api/mindlog`, `/api/think` |
| `agent/lib/page.ts` | the single-file UI |

## Model

`deepseek/deepseek-v4-flash` through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway).
Change the id in `agent/agent.ts`; it is a Gateway catalog slug, so no provider
package is involved. Set `modelContextWindowTokens` to match, because the
middleware that caps output tokens hides the id from eve's catalog lookup.

Credentials, either one:

- `AI_GATEWAY_API_KEY=vck_...` in `.env.local`. Does not expire; best for local
  development of something meant to run unattended.
- `eve link --project <name> --team <team>`, which pulls a `VERCEL_OIDC_TOKEN`
  into `.env.local`. Convenient, but expires in about 12 hours.

A Vercel deployment authenticates through project OIDC, so it needs neither.

## Known limits

- A heartbeat turn has nobody to talk to: its reply is discarded and only the
  mindlog survives it. The agent cannot start a conversation with you.
- The mindlog and the `/workspace` archive are local files. Deploying anywhere
  with an ephemeral filesystem means swapping the functions in
  `agent/lib/mindlog.ts` and `agent/hooks/workspace-sync.ts` for a real store.
- `/workspace` is one tarball with last-write-wins: two sessions parking at once
  means the later one overwrites. Per-session archives if that ever matters.
- Away from localhost, `/eve/v1` needs HTTP Basic credentials: set `AGENT_USER`
  and `AGENT_PASS`. Without them no browser can authenticate at all, which is
  the safe direction to fail. `localDev()` keeps localhost open under
  `eve dev` and is ignored in production.
- Compaction is eve's default. There is no exponential-decay trajectory
  summarization like headlong's.
