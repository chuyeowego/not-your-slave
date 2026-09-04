import { defineHook } from "eve/hooks";

import { append } from "../lib/mindlog";
import { Push } from "../lib/push";
import { HEARTBEAT } from "../schedules/think";

// turn.cancelled carries only a turn id, so the partial has to be kept here
// to survive cancellation.
const streaming = new Map<string, string>();

export default defineHook({
  events: {
    async "message.received"(event, ctx) {
      // Heartbeats and human messages share one address, so the
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
    "message.appended"(event) {
      streaming.set(event.data.turnId, event.data.messageSoFar);
    },
    async "message.completed"(event, ctx) {
      streaming.delete(event.data.turnId);
      if (event.data.message === null) return;
      await append({ kind: "said", text: event.data.message, sessionId: ctx.session.id });
      await Push.fanout(event.data.message);
    },
    // A steering message replaced this turn. Whatever it had already said was
    // real - a human watching the page saw it - so it belongs in the log,
    // marked as unfinished rather than silently dropped.
    async "turn.cancelled"(event, ctx) {
      const partial = streaming.get(event.data.turnId);
      streaming.delete(event.data.turnId);
      if (!partial) return;
      const text = `${partial} […interrupted]`;
      await append({ kind: "said", text, sessionId: ctx.session.id });
      await Push.fanout(text);
    },
    "turn.failed"(event) {
      streaming.delete(event.data.turnId);
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
