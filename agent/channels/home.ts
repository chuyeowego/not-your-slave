import { defineChannel, GET, HEAD, POST } from "eve/channels";
import { routeAuth } from "eve/channels/auth";

import { policy } from "../lib/auth";
import { entryPage } from "../lib/entry-page";
import { around, read, version } from "../lib/mindlog";
import { PAGE } from "../lib/page";
import { Pwa } from "../lib/pwa";
import { Push } from "../lib/push";
import { HEARTBEAT, TIMELINE } from "../schedules/think";

// A channel's own routes are not covered by the eve channel's auth policy, so
// each one walks the same policy itself. Returning the Response means the
// browser gets the Basic challenge and prompts for credentials.
const guard = async (request: Request): Promise<Response | null> => {
  const result = await routeAuth(request, policy);
  return result instanceof Response ? result : null;
};

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
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

    // Installable bits have no secrets. Leaving them unguarded means a browser
    // can fetch the manifest and worker without replaying Basic auth.
    GET("/manifest.webmanifest", async () =>
      new Response(Pwa.manifest(), { headers: { "content-type": "application/manifest+json; charset=utf-8" } }),
    ),
    HEAD("/manifest.webmanifest", async () =>
      new Response(null, { headers: { "content-type": "application/manifest+json; charset=utf-8" } }),
    ),

    GET("/sw.js", async () =>
      new Response(Pwa.serviceWorker(), {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "service-worker-allowed": "/",
        },
      }),
    ),
    HEAD("/sw.js", async () =>
      new Response(null, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "service-worker-allowed": "/",
        },
      }),
    ),

    GET("/icon.svg", async () =>
      new Response(Pwa.iconSvg(), { headers: { "content-type": "image/svg+xml; charset=utf-8" } }),
    ),
    HEAD("/icon.svg", async () =>
      new Response(null, { headers: { "content-type": "image/svg+xml; charset=utf-8" } }),
    ),

    GET("/icon-192.png", async () =>
      new Response(Buffer.from(Pwa.iconPng(192)), { headers: { "content-type": "image/png" } }),
    ),
    HEAD("/icon-192.png", async () =>
      new Response(null, { headers: { "content-type": "image/png" } }),
    ),

    GET("/icon-512.png", async () =>
      new Response(Buffer.from(Pwa.iconPng(512)), { headers: { "content-type": "image/png" } }),
    ),
    HEAD("/icon-512.png", async () =>
      new Response(null, { headers: { "content-type": "image/png" } }),
    ),

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

    GET("/api/push/vapid", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const publicKey = Push.publicKey();
      if (publicKey === null) {
        return Response.json({ ok: false, error: "vapid not configured", publicKey: null }, { status: 503 });
      }
      return Response.json({ ok: true, publicKey });
    }),

    POST("/api/push/subscribe", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const parsed = Push.parseSubscription(await readJson(request));
      if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
      await Push.subscribe(parsed.value);
      return Response.json({ ok: true });
    }),

    POST("/api/push/unsubscribe", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const body = await readJson(request);
      const endpoint =
        typeof body === "object" && body !== null && "endpoint" in body && typeof body.endpoint === "string"
          ? body.endpoint.trim()
          : "";
      if (endpoint.length === 0 || !Push.allowedEndpoint(endpoint)) {
        return Response.json({ ok: false, error: "endpoint required" }, { status: 400 });
      }
      await Push.unsubscribe(endpoint);
      return Response.json({ ok: true });
    }),

    POST("/api/push/test", async (request) => {
      const denied = await guard(request);
      if (denied) return denied;

      const result = await Push.send({
        title: "not-your-slave",
        body: "push is on",
        url: "/",
        silentIfFocused: false,
      });
      if (result.ok && "skipped" in result && result.skipped === "vapid") {
        return Response.json(result, { status: 503 });
      }
      return Response.json(result);
    }),
  ],
});
