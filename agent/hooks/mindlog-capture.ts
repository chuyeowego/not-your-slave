import { defineHook } from "eve/hooks";

import { append } from "../lib/mindlog";
import { HEARTBEAT } from "../schedules/think";

// Everything that happens to the agent lands in one timeline, whoever caused
// it: a wake-up it gave itself, a human message, its own reasoning, its own
// reply, a tool it ran.
export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      // Heartbeats and human messages now share one address, so the
      // continuation token cannot tell them apart. A cron dispatch still
      // reports kind "schedule"; the exact prompt text covers the manual wake
      // button, which sends the same constant.
      const woke = ctx.channel.kind === "schedule" || event.data.message.trim() === HEARTBEAT.trim();
      await append({
        kind: woke ? "woke" : "heard",
        text: woke ? "heartbeat" : event.data.message,
        sessionId: ctx.session.id,
      });
    },
    async "reasoning.completed"(event, ctx) {
      await append({ kind: "thought", text: event.data.reasoning, sessionId: ctx.session.id });
    },
    async "message.completed"(event, ctx) {
      if (event.data.message === null) return;
      await append({ kind: "said", text: event.data.message, sessionId: ctx.session.id });
    },
    async "action.result"(event, ctx) {
      // eve's result union is discriminated on `kind`, so a loaded skill and a
      // delegated subagent are named as themselves rather than dropped.
      const result = event.data.result;
      const name =
        result.kind === "tool-result"
          ? result.toolName
          : result.kind === "subagent-result"
            ? `subagent ${result.subagentName}`
            : `skill ${result.name ?? "?"}`;
      await append({ kind: "did", text: `${name} (${event.data.status})`, sessionId: ctx.session.id });
    },
  },
});
