import { defineChannel, GET, POST } from "eve/channels";
import { routeAuth } from "eve/channels/auth";

import { stat } from "node:fs/promises";

import { policy } from "../lib/auth";
import { FILE, read } from "../lib/mindlog";
import { PAGE } from "../lib/page";
import { HEARTBEAT, WAKE_ADDRESS } from "../schedules/think";

// A channel's own routes are not covered by the eve channel's auth policy, so
// each one walks the same policy itself. Returning the Response means the
// browser gets the Basic challenge and prompts for credentials.
const guard = async (request: Request): Promise<Response | null> => {
  const result = await routeAuth(request, policy);
  return result instanceof Response ? result : null;
};

export default defineChannel({
  routes: [
    GET("/", async (request) => {
      const denied = await guard(request);
      return denied ?? new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }),

    // Polled every few seconds by every open tab, so an unchanged log answers
    // 304 instead of re-shipping a hundred entries.
    GET("/api/mindlog", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? 80);
      const size = await stat(FILE).then((s) => `${s.size}:${s.mtimeMs}`, () => "0");
      const etag = `W/"${size}:${limit}"`;

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

      const session = await from(WAKE_ADDRESS).send(HEARTBEAT, { auth: null });
      return Response.json({ sessionId: session.id });
    }),
  ],
});
