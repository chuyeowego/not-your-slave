import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { LivePostgres } from "./helpers/live-postgres.ts";

describe("push postgres store", () => {
  let url: string;
  let sql: ReturnType<typeof postgres>;
  let Push: typeof import("#lib/push.ts").Push;

  beforeAll(async () => {
    url = await LivePostgres.ensureDatabase(LivePostgres.advertisedUrl());
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", url);
    delete process.env.POSTGRES_URL;
    ({ Push } = await import("#lib/push.ts"));
    sql = postgres(url, { max: 1 });
    await LivePostgres.ping(sql, url);
    await Push.list();
    console.log(`[push-postgres] database host=${LivePostgres.describe(url).host} port=${LivePostgres.describe(url).port}`);
  });

  beforeEach(async () => {
    await sql`truncate push_subscriptions`;
  });

  afterAll(async () => {
    await Push?.disconnect();
    await sql?.end();
  });

  test("upserts by endpoint on the live server", async () => {
    expect(process.env.DATABASE_URL).toBe(url);
    await Push.subscribe({ endpoint: "https://push.example/a", p256dh: "one", auth: "auth1" });
    await Push.subscribe({ endpoint: "https://push.example/a", p256dh: "two", auth: "auth2" });
    expect(await Push.list()).toEqual([
      { endpoint: "https://push.example/a", p256dh: "two", auth: "auth2" },
    ]);
    await Push.unsubscribe("https://push.example/a");
    expect(await Push.list()).toEqual([]);
  });
});
