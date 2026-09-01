import { httpBasic, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const username = process.env.AGENT_USER;
const password = process.env.AGENT_PASS;

export default eveChannel({
  auth: [
    // Internal runtime, subagent and cron callers, and the eve TUI.
    vercelOidc(),
    // A person, in a browser. The team has other members and Vercel's own
    // deployment protection is team-wide, so identity lives here instead.
    // Missing credentials mean no browser can authenticate at all, which is
    // the safe direction to fail.
    ...(username !== undefined && password !== undefined
      ? [httpBasic({ username, password }, { realm: "not-your-slave" })]
      : []),
    // Localhost during `eve dev`. Ignored in production.
    localDev(),
  ],
});
