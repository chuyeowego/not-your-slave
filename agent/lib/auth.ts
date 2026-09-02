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

export const policy: readonly AuthFn<Request>[] = [
  vercelOidc(),
  // Vercel deployment protection is team-wide, so identity lives here instead.
  basic,
  localDev(),
];
