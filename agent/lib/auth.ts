import {
  localDev,
  vercelOidc,
  verifyHttpBasic,
  withAuthChallenges,
  type AuthFn,
} from "eve/channels/auth";

const REALM = "not-your-slave";

// Credentials are read per request, not at module load. Vercel's "sensitive"
// environment variables are runtime-only and invisible to the build, so a
// policy assembled at module scope silently loses the password and locks
// everyone out. Reading on each call also means rotating the password needs no
// deploy of this code.
const basic: AuthFn<Request> = withAuthChallenges((request) => {
  const username = process.env.AGENT_USER;
  const password = process.env.AGENT_PASS;
  if (username === undefined || password === undefined) return null;

  const result = verifyHttpBasic(request.headers.get("authorization"), { username, password });
  return result.ok ? result.sessionAuth : null;
}, [{ scheme: "Basic", parameters: { realm: REALM, charset: "UTF-8" } }]);

// One policy for every route the agent serves: eve's own /eve/v1 surface and
// the authored routes in channels/home.ts. Kept here so the page, the mindlog
// endpoint and the session API cannot drift apart on who may call them.
export const policy: readonly AuthFn<Request>[] = [
  // Internal runtime, subagent and cron callers, and the eve TUI.
  vercelOidc(),
  // A person, in a browser. Vercel's deployment protection is team-wide and
  // this team has other members, so identity lives here instead.
  basic,
  // Localhost during `eve dev`. Authenticates nothing in production.
  localDev(),
];
