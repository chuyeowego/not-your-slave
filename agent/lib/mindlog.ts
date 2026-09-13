import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";

import postgres from "postgres";

export type MindlogKind = "woke" | "heard" | "thought" | "said" | "did" | "note";

export interface MindlogImage {
  data: string;
  filename: string;
  mediaType: string;
}

export interface MindlogEntry {
  id?: string;
  at: string;
  kind: MindlogKind;
  text: string;
  sessionId?: string;
  images?: MindlogImage[];
}

/** Drop image bytes so tools and the sandbox copy stay text-sized. */
export function withoutImages(entry: MindlogEntry): MindlogEntry {
  if (entry.images === undefined) return entry;
  const { images: _images, ...rest } = entry;
  return rest;
}

function imagesOf(value: unknown): MindlogImage[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const images: MindlogImage[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as { data?: unknown; filename?: unknown; mediaType?: unknown };
    if (typeof rec.data !== "string" || !rec.data.startsWith("data:image/")) continue;
    if (typeof rec.mediaType !== "string" || !rec.mediaType.startsWith("image/")) continue;
    const filename = typeof rec.filename === "string" && rec.filename.trim().length > 0 ? rec.filename : "image";
    images.push({ data: rec.data, filename, mediaType: rec.mediaType });
  }
  return images.length > 0 ? images : undefined;
}

/** eve's message.received `parts` include a `url` only for data:/http(s) attachments. */
export function imagesFromParts(parts: unknown): MindlogImage[] | undefined {
  if (!Array.isArray(parts)) return undefined;
  const images: MindlogImage[] = [];
  for (const part of parts) {
    if (part === null || typeof part !== "object") continue;
    const item = part as { filename?: unknown; mediaType?: unknown; type?: unknown; url?: unknown };
    if (item.type !== "file") continue;
    if (typeof item.url !== "string" || !item.url.startsWith("data:image/")) continue;
    if (typeof item.mediaType !== "string" || !item.mediaType.startsWith("image/")) continue;
    const filename = typeof item.filename === "string" && item.filename.trim().length > 0 ? item.filename : "image";
    images.push({ data: item.url, filename, mediaType: item.mediaType });
  }
  return images.length > 0 ? images : undefined;
}

const withImages = (entry: MindlogEntry, raw: unknown): MindlogEntry => {
  const images = imagesOf(raw);
  return images === undefined ? entry : { ...entry, images };
};

const newId = (): string => randomBytes(6).toString("hex");

/** The id a permalink uses: the entry's own id, or its timestamp if it predates ids. */
export const keyOf = (entry: MindlogEntry): string => entry.id ?? entry.at;

export const FILE = process.env.MINDLOG_FILE ?? ".data/mindlog.jsonl";

// Which store is in use is decided per call, not at module load: a deployment's
// connection string can be a Vercel "sensitive" variable, which the build never
// sees. Locally, with nothing configured, the file keeps `npm run dev` free of
// setup.
const url = (): string | undefined => process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

function clean(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/* ---------------------------------------------------------------- postgres */

let client: ReturnType<typeof postgres> | undefined;
let ready: Promise<unknown> | undefined;

function sql() {
  const db = (client ??= postgres(url()!, { max: 3, idle_timeout: 20 }));
  ready ??= db`
    create table if not exists mindlog (
      id bigserial primary key,
      at timestamptz not null default now(),
      kind text not null,
      text text not null,
      session_id text
    )`
    .then(() => db`alter table mindlog add column if not exists entry_id text`)
    .then(() => db`create index if not exists mindlog_entry_id_idx on mindlog (entry_id)`)
    .then(() => db`alter table mindlog add column if not exists images jsonb`);
  return db;
}

// Cached for the process; tests call this so the Vitest worker can exit.
export async function disconnect(): Promise<void> {
  const current = client;
  client = undefined;
  ready = undefined;
  if (current !== undefined) await current.end();
}

// Rows come back newest-first because that is the indexed direction; the file
// store hands back oldest-first, so reverse to keep one shape for both.
const row = (x: Record<string, unknown>): MindlogEntry =>
  withImages(
    {
      ...(x.entry_id === null || x.entry_id === undefined ? {} : { id: x.entry_id as string }),
      at: (x.at as Date).toISOString(),
      kind: x.kind as MindlogKind,
      text: x.text as string,
      ...(x.session_id === null ? {} : { sessionId: x.session_id as string }),
    },
    x.images,
  );

const rows = (r: readonly Record<string, unknown>[]): MindlogEntry[] => r.map(row).reverse();

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
    try {
      const entry = JSON.parse(line) as MindlogEntry;
      return [withImages(entry, entry.images)];
    } catch {
      return [];
    }
  });

let dirReady: Promise<unknown> | undefined;

/* ------------------------------------------------------------------ public */

export async function append(entry: Omit<MindlogEntry, "at">): Promise<void> {
  const text = clean(entry.text);
  if (text === null) return;

  const images = imagesOf(entry.images);

  if (url() !== undefined) {
    const db = sql();
    await ready;
    if (images === undefined) {
      await db`insert into mindlog ${db({
        entry_id: newId(),
        kind: entry.kind,
        text,
        session_id: entry.sessionId ?? null,
      })}`;
    } else {
      await db`insert into mindlog ${db({
        entry_id: newId(),
        kind: entry.kind,
        text,
        session_id: entry.sessionId ?? null,
        images: db.json(images as never),
      })}`;
    }
    return;
  }

  const { images: _ignored, ...fields } = entry;
  const line = JSON.stringify({
    id: newId(),
    at: new Date().toISOString(),
    ...fields,
    text,
    ...(images === undefined ? {} : { images }),
  });
  dirReady ??= mkdir(dirname(FILE), { recursive: true });
  await dirReady;
  await appendFile(FILE, `${line}\n`, "utf8");
}

export async function read(limit = 50, before?: string): Promise<MindlogEntry[]> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    return rows(
      before === undefined
        ? await db`select entry_id, at, kind, text, session_id, images from mindlog order by id desc limit ${limit}`
        : await db`select entry_id, at, kind, text, session_id, images from mindlog
                   where at < ${before} order by id desc limit ${limit}`,
    );
  }

  const all = parse(await fileLines());
  const bounded = before === undefined ? all : all.filter((entry) => entry.at < before);
  return bounded.slice(-limit);
}

export async function search(query: string, limit = 20): Promise<MindlogEntry[]> {
  const needle = query.toLowerCase();

  if (url() !== undefined) {
    const db = sql();
    await ready;
    return rows(
      await db`select entry_id, at, kind, text, session_id, images from mindlog
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

export interface MindlogNeighbourhood {
  before: MindlogEntry[];
  entry: MindlogEntry;
  after: MindlogEntry[];
}

/** One entry by permalink key, with the entries either side of it for context. */
export async function around(key: string, radius = 3): Promise<MindlogNeighbourhood | null> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    // Two lookups rather than one OR: comparing a hex id against a timestamptz
    // column is a type error, not a miss.
    const [byId] = await db`select id, entry_id, at, kind, text, session_id, images from mindlog
                            where entry_id = ${key} limit 1`;
    const found =
      byId ??
      (Number.isNaN(Date.parse(key))
        ? undefined
        : (
            // Stored microseconds would not equal a millisecond ISO string.
            await db`select id, entry_id, at, kind, text, session_id, images from mindlog
                     where date_trunc('milliseconds', at) = ${key}::timestamptz limit 1`
          )[0]);
    if (found === undefined) return null;

    const seq = found.id as number;
    const before = await db`select entry_id, at, kind, text, session_id, images from mindlog
                            where id < ${seq} order by id desc limit ${radius}`;
    const after = await db`select entry_id, at, kind, text, session_id, images from mindlog
                           where id > ${seq} order by id asc limit ${radius}`;
    return {
      before: before.map(row).reverse(),
      entry: row(found),
      after: after.map(row),
    };
  }

  const all = parse(await fileLines());
  const index = all.findIndex((candidate) => keyOf(candidate) === key);
  if (index === -1) return null;
  return {
    before: all.slice(Math.max(0, index - radius), index),
    entry: all[index],
    after: all.slice(index + 1, index + 1 + radius),
  };
}
