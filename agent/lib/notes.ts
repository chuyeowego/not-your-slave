import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import postgres from "postgres";
import { z } from "zod";

/**
 * Rewritable pages, not the mindlog. The journal is append-only and records
 * what happened; this is the notebook the agent can name, rewrite, and throw
 * away. Same durability split as the mindlog: Postgres when a connection
 * string is set, a file otherwise, so `eve dev` keeps working with no setup.
 */

export const NOTE_NAME_MAX = 128;
export const NOTE_BODY_MAX = 100_000;

export interface Note {
  name: string;
  body: string;
  updatedAt: string;
}

export interface NoteMeta {
  name: string;
  chars: number;
  updatedAt: string;
}

export const FILE = process.env.NOTES_FILE ?? ".data/notes.jsonl";

const url = (): string | undefined => process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

/** A page name is a key, not a host path: no `..`, no leading slash. */
export function parseName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > NOTE_NAME_MAX) return null;
  if (trimmed.startsWith("/") || trimmed.endsWith("/")) return null;
  const parts = trimmed.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) return null;
  if (!parts.every((part) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part))) return null;
  return trimmed;
}

export const noteNameSchema = z
  .string()
  .min(1)
  .max(NOTE_NAME_MAX)
  .refine((name) => parseName(name) !== null, {
    message: "use letters, numbers, dots, dashes and slashes; no empty or dot segments",
  })
  .transform((name) => parseName(name)!);

export const noteBodySchema = z.string().max(NOTE_BODY_MAX);

/* ---------------------------------------------------------------- postgres */

let client: ReturnType<typeof postgres> | undefined;
let ready: Promise<unknown> | undefined;

function sql() {
  const db = (client ??= postgres(url()!, { max: 3, idle_timeout: 20 }));
  ready ??= db`
    create table if not exists notes (
      name text primary key,
      body text not null,
      updated_at timestamptz not null default now()
    )`;
  return db;
}

export async function disconnect(): Promise<void> {
  const current = client;
  client = undefined;
  ready = undefined;
  if (current !== undefined) await current.end();
}

const row = (x: Record<string, unknown>): Note => ({
  name: x.name as string,
  body: x.body as string,
  updatedAt: (x.updated_at as Date).toISOString(),
});

/* -------------------------------------------------------------------- file */

type RawNote = { name?: unknown; body?: unknown; updatedAt?: unknown };

const parse = (raw: string[]): Note[] =>
  raw.flatMap((line) => {
    try {
      const entry = JSON.parse(line) as RawNote;
      if (typeof entry.name !== "string" || typeof entry.body !== "string") return [];
      const name = parseName(entry.name);
      if (name === null) return [];
      if (entry.body.length > NOTE_BODY_MAX) return [];
      const updatedAt =
        typeof entry.updatedAt === "string" && !Number.isNaN(Date.parse(entry.updatedAt))
          ? new Date(entry.updatedAt).toISOString()
          : new Date(0).toISOString();
      return [{ name, body: entry.body, updatedAt }];
    } catch {
      return [];
    }
  });

async function fileLines(): Promise<string[]> {
  try {
    return (await readFile(FILE, "utf8")).split("\n").filter((line) => line.trim().length > 0);
  } catch {
    return [];
  }
}

async function fileAll(): Promise<Note[]> {
  return parse(await fileLines());
}

let dirReady: Promise<unknown> | undefined;

async function fileSave(notes: Note[]): Promise<void> {
  dirReady ??= mkdir(dirname(FILE), { recursive: true });
  await dirReady;
  const body = notes.length === 0 ? "" : `${notes.map((note) => JSON.stringify(note)).join("\n")}\n`;
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, FILE);
}

const byName = (left: Note, right: Note): number => left.name.localeCompare(right.name);

const metaOf = (note: Note): NoteMeta => ({
  name: note.name,
  chars: note.body.length,
  updatedAt: note.updatedAt,
});

/* ------------------------------------------------------------------ public */

export async function list(): Promise<NoteMeta[]> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    const rows = await db`select name, length(body)::int as chars, updated_at from notes order by name`;
    return rows.map((x) => ({
      name: x.name as string,
      chars: x.chars as number,
      updatedAt: (x.updated_at as Date).toISOString(),
    }));
  }

  return (await fileAll()).sort(byName).map(metaOf);
}

export async function readAll(): Promise<Note[]> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    return (await db`select name, body, updated_at from notes order by name`).map(row);
  }

  return (await fileAll()).sort(byName);
}

export async function read(name: string): Promise<Note | null> {
  const key = parseName(name);
  if (key === null) return null;

  if (url() !== undefined) {
    const db = sql();
    await ready;
    const [found] = await db`select name, body, updated_at from notes where name = ${key} limit 1`;
    return found === undefined ? null : row(found);
  }

  return (await fileAll()).find((note) => note.name === key) ?? null;
}

export async function write(name: string, body: string): Promise<Note> {
  const key = parseName(name);
  if (key === null) throw new Error("invalid note name");
  if (body.length > NOTE_BODY_MAX) throw new Error("note too long");

  if (url() !== undefined) {
    const db = sql();
    await ready;
    const [saved] = await db`
      insert into notes (name, body) values (${key}, ${body})
      on conflict (name) do update set body = excluded.body, updated_at = now()
      returning name, body, updated_at`;
    return row(saved);
  }

  const notes = (await fileAll()).filter((note) => note.name !== key);
  const next: Note = { name: key, body, updatedAt: new Date().toISOString() };
  notes.push(next);
  await fileSave(notes.sort(byName));
  return next;
}

export async function remove(name: string): Promise<boolean> {
  const key = parseName(name);
  if (key === null) return false;

  if (url() !== undefined) {
    const db = sql();
    await ready;
    const deleted = await db`delete from notes where name = ${key} returning name`;
    return deleted.length > 0;
  }

  const notes = await fileAll();
  const kept = notes.filter((note) => note.name !== key);
  if (kept.length === notes.length) return false;
  await fileSave(kept.sort(byName));
  if (kept.length === 0) {
    try {
      await unlink(FILE);
    } catch {
      // a missing file is an empty notebook
    }
  }
  return true;
}

export async function version(): Promise<string> {
  if (url() !== undefined) {
    const db = sql();
    await ready;
    const [found] = await db`
      select count(*)::int as n, coalesce(max(updated_at)::text, '0') as last from notes`;
    return `${found?.n ?? 0}:${found?.last ?? "0"}`;
  }

  try {
    const { size, mtimeMs } = await stat(FILE);
    return `${size}:${mtimeMs}`;
  } catch {
    return "0";
  }
}
