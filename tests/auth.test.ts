import { afterEach, describe, expect, test, vi } from "vitest";
import { localDev, routeAuth } from "eve/channels/auth";

import { policy } from "#lib/auth.ts";
import { BasicAuth } from "./helpers/channel.ts";

describe("auth policy", () => {
  afterEach(() => {
    delete process.env.EVE_DEV;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;
    delete process.env.AGENT_USER;
    delete process.env.AGENT_PASS;
    vi.unstubAllEnvs();
  });

  test("the walk is OIDC, then per-request basic, then localDev", () => {
    expect(policy).toHaveLength(3);
    expect(policy.every((entry) => typeof entry === "function")).toBe(true);
  });

  test("localDev authenticates only while EVE_DEV=1", async () => {
    const request = new Request("http://127.0.0.1:2000/");
    delete process.env.EVE_DEV;
    expect(await localDev()(request)).toBeNull();

    process.env.EVE_DEV = "1";
    const accepted = await localDev()(request);
    expect(accepted).toMatchObject({
      authenticator: "local-dev",
      principalType: expect.any(String),
    });
  });

  test("localDev is not flipped by Host: localhost", async () => {
    delete process.env.EVE_DEV;
    const request = new Request("http://localhost/", { headers: { host: "localhost" } });
    expect(await localDev()(request)).toBeNull();
    expect(await routeAuth(request, policy)).toBeInstanceOf(Response);
    expect((await routeAuth(request, policy) as Response).status).toBe(401);
  });

  test("routeAuth accepts localhost traffic under EVE_DEV", async () => {
    process.env.EVE_DEV = "1";
    const result = await routeAuth(new Request("http://127.0.0.1:2000/"), policy);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({ authenticator: "local-dev" });
  });

  test("basic credentials are read per request, not at module load", async () => {
    delete process.env.EVE_DEV;
    const request = new Request("http://example.test/", {
      headers: { authorization: BasicAuth.header("op", "s3cret") },
    });

    expect(await routeAuth(request, policy)).toBeInstanceOf(Response);

    process.env.AGENT_USER = "op";
    process.env.AGENT_PASS = "s3cret";
    const accepted = await routeAuth(request, policy);
    expect(accepted).not.toBeInstanceOf(Response);
    expect(accepted).toMatchObject({ authenticator: expect.any(String) });
  });

  test("wrong basic credentials do not authenticate", async () => {
    delete process.env.EVE_DEV;
    process.env.AGENT_USER = "op";
    process.env.AGENT_PASS = "s3cret";
    const request = new Request("http://example.test/", {
      headers: { authorization: BasicAuth.header("op", "nope") },
    });
    const denied = await routeAuth(request, policy);
    expect(denied).toBeInstanceOf(Response);
    expect((denied as Response).status).toBe(401);
    expect((denied as Response).headers.get("www-authenticate")).toMatch(/Basic/);
    expect((denied as Response).headers.get("www-authenticate")).toMatch(/not-your-slave/);
  });
});
