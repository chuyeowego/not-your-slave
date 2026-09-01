import { httpBasic, localDev, vercelOidc, type AuthFn } from "eve/channels/auth";

// One policy for every route the agent serves: eve's own /eve/v1 surface and
// the authored routes in channels/home.ts. Kept here so the page, the mindlog
// endpoint and the session API cannot drift apart on who may call them.
const username = process.env.AGENT_USER;
const password = process.env.AGENT_PASS;

export const policy: readonly AuthFn<Request>[] = [
  // Internal runtime, subagent and cron callers, and the eve TUI.
  vercelOidc(),
  // A person, in a browser. Vercel's deployment protection is team-wide and
  // this team has other members, so identity lives here instead. With either
  // secret missing the entry is omitted, so no browser can authenticate at
  // all: the safe direction to fail.
  ...(username !== undefined && password !== undefined
    ? [httpBasic({ username, password }, { realm: "not-your-slave" })]
    : []),
  // Localhost during `eve dev`. Authenticates nothing in production.
  localDev(),
];
