import { defineChannel, GET, POST } from "eve/channels";
import { routeAuth } from "eve/channels/auth";

import { policy } from "../lib/auth";
import { entryPage } from "../lib/entry-page";
import { around, read, version } from "../lib/mindlog";
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

    GET("/entry/:key", async (request, { params }) => {
      const denied = await guard(request);
      if (denied) return denied;

      const place = await around(decodeURIComponent(params.key), 3);
      if (place === null) {
        return new Response("No such entry.", { status: 404, headers: { "content-type": "text/plain" } });
      }
      return new Response(entryPage(place, new URL(request.url).origin), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }),

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
      const before = url.searchParams.get("before") ?? undefined;
      const etag = `W/"${await version()}:${limit}:${before ?? ""}"`;

      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return Response.json(
        { entries: await read(Number.isFinite(limit) ? limit : 80, before) },
        { headers: { etag } },
      );
    }),

    // Fire a heartbeat by hand. `eve dev` never runs cron, so this is how you
    // watch it think without waiting for production's next tick.
    POST("/api/think", async (request, { from }) => {
      const denied = await guard(request);
      if (denied) return denied;

      // Queued for the same reason as the cron beat: waking it by hand should
      // not cancel whatever it is in the middle of saying.
      const session = await from(TIMELINE).send(HEARTBEAT, { auth: null, turnPolicy: "queue" });
      return Response.json({ sessionId: session.id });
    }),
  ],
});
