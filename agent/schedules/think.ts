import { defineSchedule } from "eve/schedules";

import home from "../channels/home";

// The one channel-local address the agent lives at. Heartbeats and human
// messages both go here, so they share a session: one context, one sandbox,
// one timeline. eve reports it back to hooks as the continuation token,
// namespaced by channel id ("home:timeline").
export const TIMELINE = "timeline";

export const HEARTBEAT = `You just woke up on your own. Nobody asked you anything.

Read your mindlog with \`mindlog_read\` to find out where you left off, then
continue your own thread of thought. Follow something you left unfinished,
question something you concluded too quickly, or notice something you have been
circling for a while.

Follow one thread this beat, then stop, even if a second one looks interesting
– there will be another beat. If genuinely nothing is worth thinking about right
now, say so in a single line and stop; an idle beat is a legitimate outcome.

Whatever you say is logged for you, so reach for \`mindlog_append\` only when you
want something in the log that your reply does not already carry: a decision to
hold to, a question to come back to, a fact worth keeping where you will find
it again.

Nobody asked for this and nobody is waiting on it, so do not greet anyone, ask
anyone a question, or promise a follow-up. Your words are still on the record:
they land in the conversation under a \`woke\` mark and stay in the mindlog, so
whoever opens the page reads them in their own time. Write a note to yourself
that someone may read over your shoulder, not a message to someone.`;

export default defineSchedule({
  cron: "*/15 * * * *",
  // Handler form, not markdown: a markdown schedule starts a new session on
  // every fire, and a new session means a new sandbox. Sending through the
  // home channel reuses the session that owns the wake address.
  async run({ to, waitUntil, appAuth }) {
    // Queue, not eve's default "steer": a beat arriving mid-turn would cancel
    // the turn it interrupts, so a heartbeat could cut off an answer to a
    // human halfway through. A beat has no deadline - it waits for the turn to
    // settle. The reverse still steers, which is what you want: a human
    // message interrupting a heartbeat should take over.
    waitUntil(to(home, {}).send(HEARTBEAT, { auth: appAuth, turnPolicy: "queue" }));
  },
});
