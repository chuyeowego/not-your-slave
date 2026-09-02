import postgres from "postgres";
import { vi } from "vitest";

export type MindlogApi = typeof import("#lib/mindlog.ts");

export interface RawMindlogRow {
  at?: Date | string;
  entry_id?: string | null;
  kind?: string;
  text: string;
  session_id?: string | null;
}

export interface PostgresFingerprint {
  version: string;
  database: string;
  host: string;
  port: string;
}

/**
 * Live Postgres for mindlog tests: a throwaway database, then the real
 * `postgres` client and `mindlog.ts`. File-store tests never see this URL.
 */
export class LivePostgres {
  static readonly DATABASE = "mindlog_test";

  private constructor(
    readonly url: string,
    readonly api: MindlogApi,
    readonly sql: ReturnType<typeof postgres>,
    readonly fingerprint: PostgresFingerprint,
  ) {}

  static advertisedUrl(): string {
    return (
      process.env.MINDLOG_TEST_DATABASE_URL ??
      `postgres://postgres:test@localhost:${process.env.MINDLOG_DB_PORT ?? "55432"}/mindlog`
    );
  }

  static rewriteDatabase(url: string, name: string): string {
    const parsed = new URL(url);
    parsed.pathname = `/${name}`;
    return parsed.href;
  }

  static describe(url: string): Pick<PostgresFingerprint, "host" | "port"> {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: parsed.port || "5432" };
  }

  static async ensureDatabase(adminUrl: string): Promise<string> {
    if (process.env.MINDLOG_TEST_DATABASE_URL !== undefined) {
      return process.env.MINDLOG_TEST_DATABASE_URL;
    }

    const admin = postgres(adminUrl, { max: 1 });
    try {
      await LivePostgres.ping(admin, adminUrl);
      const found = await admin`select 1 from pg_database where datname = ${LivePostgres.DATABASE}`;
      if (found.length === 0) {
        try {
          await admin.unsafe(`create database ${LivePostgres.DATABASE}`);
        } catch (error) {
          const duplicate = error instanceof Error && /already exists/i.test(error.message);
          if (!duplicate) throw error;
        }
      }
    } finally {
      await admin.end();
    }
    return LivePostgres.rewriteDatabase(adminUrl, LivePostgres.DATABASE);
  }

  static async ping(sql: ReturnType<typeof postgres>, url: string): Promise<void> {
    try {
      await sql`select 1`;
    } catch (error) {
      const { host, port } = LivePostgres.describe(url);
      throw new Error(
        [
          "mindlog postgres tests need a live Postgres server.",
          "Locally: npm run db:up  (docker postgres:17-alpine on :55432), then npm test.",
          "Or set MINDLOG_TEST_DATABASE_URL to a reachable database.",
          `Tried ${host}:${port}.`,
          error instanceof Error ? error.message : String(error),
        ].join("\n"),
      );
    }
  }

  static async open(): Promise<LivePostgres> {
    const url = await LivePostgres.ensureDatabase(LivePostgres.advertisedUrl());
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", url);
    delete process.env.POSTGRES_URL;

    const api = await import("#lib/mindlog.ts");
    const sql = postgres(url, { max: 1 });
    await LivePostgres.ping(sql, url);
    await api.version();
    await sql`truncate mindlog restart identity`;

    const [row] = await sql<{ version: string; database: string }[]>`
      select version() as version, current_database() as database
    `;
    const { host, port } = LivePostgres.describe(url);
    return new LivePostgres(url, api, sql, {
      version: row.version,
      database: row.database,
      host,
      port,
    });
  }

  async reset(): Promise<void> {
    await this.sql`truncate mindlog restart identity`;
  }

  async insertRaw(row: RawMindlogRow): Promise<void> {
    const at = row.at ?? new Date();
    const entryId = row.entry_id === undefined ? null : row.entry_id;
    const kind = row.kind ?? "note";
    const sessionId = row.session_id ?? null;
    await this.sql`
      insert into mindlog (at, entry_id, kind, text, session_id)
      values (${at}, ${entryId}, ${kind}, ${row.text}, ${sessionId})
    `;
  }

  async serial(): Promise<{ n: number; last: number }> {
    const [row] = await this.sql<{ n: number; last: number }[]>`
      select count(*)::int as n, coalesce(max(id), 0)::int as last from mindlog
    `;
    return row;
  }

  async close(): Promise<void> {
    await this.api.disconnect();
    await this.sql.end();
  }
}
