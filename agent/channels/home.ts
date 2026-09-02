import { defineChannel, GET, POST } from "eve/channels";
import { routeAuth } from "eve/channels/auth";

import { policy } from "../lib/auth";
import { read, version } from "../lib/mindlog";
import { PAGE } from "../lib/page";
import { HEARTBEAT, TIMELINE } from "../schedules/think";

// A channel's own routes are not covered by the eve channel's auth policy, so
// each one walks the same policy itself. Returning the Response means the
// browser gets the Basic challenge and prompts for credentials.
const guard = async (request: Request): Promise<Response | null> => {
  const result = await routeAuth(request, policy);
  return result instanceof Response ? result : null;
};

export default defineChannel({
  // A schedule hands its wake-up here, and it goes to the same address every
  // human message goes to, so the agent has one session: one context, one
  // sandbox, one timeline it can read back.
  receive: async ({ message, auth }, { from }) => from(TIMELINE).send(message, { auth }),

  routes: [
    GET("/", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      // The page marks a wake-up in the conversation, so it needs to recognise
      // one. It gets the prompt's opening line rather than its own copy.
      const html = PAGE.replace("__WAKE_PREFIX__", JSON.stringify(HEARTBEAT.split("\n")[0]));
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }),

    // Polled every few seconds by every open tab, so an unchanged log answers
    // 304 instead of re-shipping a hundred entries.
    // The agent's session, if it has one yet. The page asks at load so it can
    // replay the timeline without having to remember an id across refreshes.
    GET("/api/session", async (request, { resolveSession }) => {
      const denied = await guard(request);
      if (denied) return denied;

      const session = await resolveSession(TIMELINE);
      return Response.json({ sessionId: session?.id ?? null });
    }),

    // A human message, into the same session the heartbeat uses. `from().send`
    // creates the session when the address has none, so there is no separate
    // create path and nothing for the page to reconcile.
    POST("/api/say", async (request, { from }) => {
      const denied = await guard(request);
      if (denied) return denied;

      const { message } = (await request.json()) as { message?: unknown };
      if (typeof message !== "string" || message.trim().length === 0) {
        return Response.json({ ok: false, error: "message required" }, { status: 400 });
      }

      const session = await from(TIMELINE).send(message, { auth: null });
      return Response.json({ ok: true, sessionId: session.id });
    }),

    GET("/api/mindlog", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 80);
      const etag = `W/"${await version()}:${limit}"`;

      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return Response.json(
        { entries: await read(Number.isFinite(limit) ? limit : 80) },
        { headers: { etag } },
      );
    }),

    // Fire a heartbeat by hand. `eve dev` never runs cron, so this is how you
    // watch it think without waiting for production's next tick.
    POST("/api/think", async (request, { from }) => {
      const denied = await guard(request);
      if (denied) return denied;

      const session = await from(TIMELINE).send(HEARTBEAT, { auth: null });
      return Response.json({ sessionId: session.id });
    }),
  ],
});
