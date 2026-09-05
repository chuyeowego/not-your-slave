import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import postgres from "postgres";
import webpush from "web-push";

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  silentIfFocused?: boolean;
}

export type FanoutResult =
  | { ok: true; sent: number }
  | { ok: true; skipped: "vapid" };

export type ParseResult =
  | { ok: true; value: PushSubscriptionRecord }
  | { ok: false; error: string };

const FILE = process.env.PUSH_FILE ?? ".data/push.jsonl";

const url = (): string | undefined => process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

let client: ReturnType<typeof postgres> | undefined;
let ready: Promise<unknown> | undefined;
let dirReady: Promise<unknown> | undefined;

function sql() {
  const db = (client ??= postgres(url()!, { max: 3, idle_timeout: 20 }));
  ready ??= db`
    create table if not exists push_subscriptions (
      endpoint text primary key,
      p256dh text not null,
      auth text not null,
      created_at timestamptz not null default now()
    )`;
  return db;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type WebPushFailure = Error & { statusCode?: number };

export class Push {
  static publicKey(): string | null {
    const key = process.env.VAPID_PUBLIC_KEY;
    return key !== undefined && key.length > 0 ? key : null;
  }

  static privateKey(): string | null {
    const key = process.env.VAPID_PRIVATE_KEY;
    return key !== undefined && key.length > 0 ? key : null;
  }

  static subject(): string {
    return process.env.VAPID_SUBJECT ?? "mailto:operator@localhost";
  }

  static configured(): boolean {
    return Push.publicKey() !== null && Push.privateKey() !== null;
  }

  static allowedEndpoint(endpoint: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      return false;
    }
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  }

  static parseSubscription(value: unknown): ParseResult {
    if (!isRecord(value) || typeof value.endpoint !== "string" || value.endpoint.trim().length === 0) {
      return { ok: false, error: "endpoint required" };
    }
    const endpoint = value.endpoint.trim();
    if (!Push.allowedEndpoint(endpoint)) {
      return { ok: false, error: "endpoint must be https (or localhost http)" };
    }

    const keys = isRecord(value.keys) ? value.keys : value;
    const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
    const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
    if (p256dh.length === 0 || auth.length === 0) {
      return { ok: false, error: "keys.p256dh and keys.auth required" };
    }
    return { ok: true, value: { endpoint, p256dh, auth } };
  }

  static async subscribe(record: PushSubscriptionRecord): Promise<void> {
    if (url() !== undefined) {
      const db = sql();
      await ready;
      await db`
        insert into push_subscriptions ${db(record)}
        on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`;
      return;
    }

    const rows = (await Push.readFile()).filter((entry) => entry.endpoint !== record.endpoint);
    rows.push(record);
    await Push.writeFile(rows);
  }

  static async unsubscribe(endpoint: string): Promise<void> {
    if (url() !== undefined) {
      const db = sql();
      await ready;
      await db`delete from push_subscriptions where endpoint = ${endpoint}`;
      return;
    }

    await Push.writeFile((await Push.readFile()).filter((entry) => entry.endpoint !== endpoint));
  }

  static async list(): Promise<PushSubscriptionRecord[]> {
    if (url() !== undefined) {
      const db = sql();
      await ready;
      const rows = await db`select endpoint, p256dh, auth from push_subscriptions`;
      return rows.map((row) => ({
        endpoint: row.endpoint as string,
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      }));
    }
    return Push.readFile();
  }

  static async fanout(text: string): Promise<FanoutResult> {
    return Push.send({
      title: "it said something",
      body: Push.clip(text),
      url: "/",
      silentIfFocused: true,
    });
  }

  static async send(payload: PushPayload): Promise<FanoutResult> {
    if (!Push.configured()) return { ok: true, skipped: "vapid" };

    const publicKey = Push.publicKey()!;
    const privateKey = Push.privateKey()!;
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      silentIfFocused: payload.silentIfFocused !== false,
    });

    const subscriptions = await Push.list();
    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
          { vapidDetails: { subject: Push.subject(), publicKey, privateKey } },
        );
        sent += 1;
      } catch (error) {
        const status = (error as WebPushFailure).statusCode;
        if (status === 404 || status === 410) await Push.unsubscribe(subscription.endpoint);
      }
    }
    return { ok: true, sent };
  }

  static async disconnect(): Promise<void> {
    const current = client;
    client = undefined;
    ready = undefined;
    if (current !== undefined) await current.end();
  }

  private static clip(text: string): string {
    const trimmed = text.trim().replace(/\s+/g, " ");
    return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed;
  }

  private static async readFile(): Promise<PushSubscriptionRecord[]> {
    try {
      return (await readFile(FILE, "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .flatMap((line) => {
          try {
            const parsed = Push.parseSubscription(JSON.parse(line) as unknown);
            return parsed.ok ? [parsed.value] : [];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  private static async writeFile(rows: PushSubscriptionRecord[]): Promise<void> {
    dirReady ??= mkdir(dirname(FILE), { recursive: true });
    await dirReady;
    const body = rows.length === 0 ? "" : `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
    await writeFile(FILE, body, "utf8");
  }
}
