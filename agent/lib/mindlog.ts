import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";

import postgres from "postgres";

export type MindlogKind = "woke" | "heard" | "thought" | "said" | "did" | "note";

export interface MindlogEntry {
  at: string;
  kind: MindlogKind;
  text: string;
  sessionId?: string;
}

export const FILE = process.env.MINDLOG_FILE ?? ".data/mindlog.jsonl";
const MAX_TEXT = 4000;

// Which store is in use is decided per call, not at module load: a deployment's
// connection string can be a Vercel "sensitive" variable, which the build never
// sees. Locally, with nothing configured, the file keeps `npm run dev` free of
// setup.
const url = (): string | undefined => process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

function clean(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT)}…` : trimmed;
}

/* ---------------------------------------------------------------- postgres */

let client: ReturnType<typeof postgres> | undefined;
let ready: Promise<unknown> | undefined;

function sql() {
  client ??= postgres(url()!, { max: 3, idle_timeout: 20 });
  // The table is created once per process, the same way the data directory is.
  ready ??= client`
    create table if not exists mindlog (
      id bigserial primary key,
      at timestamptz not null default now(),
      kind text not null,
      text text not null,
      session_id text
    )`;
  return client;
}

// Rows come back newest-first because that is the indexed direction; the file
// store hands back oldest-first, so reverse to keep one shape for both.
const rows = (r: readonly Record<string, unknown>[]): MindlogEntry[] =>
  r
    .map((x) => ({
      at: (x.at as Date).toISOString(),
      kind: x.kind as MindlogKind,
      text: x.text as string,
      ...(x.session_id === null ? {} : { sessionId: x.session_id as string }),
    }))
    .reverse();

/* -------------------------------------------------------------------- file */

async function fileLines(): Promise<string[]> {
  try {
    return (await readFile(FILE, "utf8")).split("\n").filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

const parse = (raw: string[]): MindlogEntry[] =>
  raw.flatMap((line) => {
    try { return [JSON.parse(line) as MindlogEntry]; } catch { return []; }
  });

let dirReady: Promise<unknown> | undefined;

/* ------------------------------------------------------------------ public */

export async function append(entry: Omit<MindlogEntry, "at">): Promise<void> {
  const text = clean(entry.text);
  if (text === null) return;

  if (url() !== undefined) {
    const db = sql();
    await ready;
    await db`insert into mindlog ${db({ kind: entry.kind, text, session_id: entry.sessionId ?? null })}`;
    return;
  }

  const line = JSON.stringify({ at: new Date().toISOString(), ...entry, text });
  dirReady ??= mkdir(dirname(FILE), { recursive: true });
  await dirReady;
  await appendFile(FILE, `${line}\n`, "utf8");
}

export async function read(limit = 50): Promise<MindlogEntry[]> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    return rows(await db`select at, kind, text, session_id from mindlog order by id desc limit ${limit}`);
  }
  return parse((await fileLines()).slice(-limit));
}

export async function search(query: string, limit = 20): Promise<MindlogEntry[]> {
  const needle = query.toLowerCase();

  if (url() !== undefined) {
    const db = sql();
    await ready;
    // ponytail: a sequential ILIKE scan. Add a pg_trgm index on text when the
    // log outgrows a scan someone notices.
    return rows(
      await db`select at, kind, text, session_id from mindlog
               where text ilike ${"%" + query + "%"} order by id desc limit ${limit}`,
    );
  }

  // Filter raw lines first so non-matching entries are never parsed, then match
  // again on `text` alone: the raw line also carries kind, timestamp and ids.
  const candidates = (await fileLines()).filter((line) => line.toLowerCase().includes(needle));
  return parse(candidates)
    .filter((entry) => entry.text.toLowerCase().includes(needle))
    .slice(-limit);
}

// A cheap fingerprint of the whole log, for HTTP caching. Anything that appends
// changes it; nothing else does.
export async function version(): Promise<string> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    const [row] = await db`select count(*)::int as n, coalesce(max(id), 0)::int as last from mindlog`;
    return `${row?.n ?? 0}:${row?.last ?? 0}`;
  }
  try {
    const { size, mtimeMs } = await stat(FILE);
    return `${size}:${mtimeMs}`;
  } catch {
    return "0";
  }
}
