import type { Channel } from "eve/channels";
import type { HttpRouteDefinition, RouteHandlerArgs } from "eve/channels";

export class HomeRoutes {
  static handler(channel: Channel, method: string, path: string): HttpRouteDefinition["handler"] {
    const route = channel.routes.find((entry) => entry.method === method && entry.path === path);
    if (route === undefined || route.transport === "websocket") {
      throw new Error(`no HTTP route ${method} ${path}`);
    }
    return route.handler;
  }

  static args(overrides: Partial<RouteHandlerArgs> = {}): RouteHandlerArgs {
    return {
      from: (() => {
        throw new Error("from() was not stubbed");
      }) as RouteHandlerArgs["from"],
      resolveSession: (async () => {
        throw new Error("resolveSession() was not stubbed");
      }) as RouteHandlerArgs["resolveSession"],
      attachSession: (() => {
        throw new Error("attachSession() was not stubbed");
      }) as RouteHandlerArgs["attachSession"],
      to: (() => {
        throw new Error("to() was not stubbed");
      }) as RouteHandlerArgs["to"],
      params: {},
      waitUntil: () => undefined,
      requestIp: null,
      ...overrides,
    };
  }
}

export class BasicAuth {
  static header(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
  }
}

/** Zod schemas sit on tools at runtime; eve's public type is a Standard Schema union. */
export class ToolSchema {
  static of(schema: unknown): {
    parse: (value: unknown) => unknown;
    safeParse: (value: unknown) => { success: boolean };
  } {
    return schema as {
      parse: (value: unknown) => unknown;
      safeParse: (value: unknown) => { success: boolean };
    };
  }
}
