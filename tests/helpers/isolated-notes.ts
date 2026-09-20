import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";

export type NotesApi = typeof import("#lib/notes.ts");

/** Fresh temp file store + module graph, so FILE and the postgres client cannot leak. */
export class IsolatedNotes {
  private constructor(
    readonly dir: string,
    readonly file: string,
    readonly api: NotesApi,
  ) {}

  static async open(): Promise<IsolatedNotes> {
    const dir = await mkdtemp(join(tmpdir(), "nys-notes-"));
    const file = join(dir, "notes.jsonl");
    vi.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    vi.stubEnv("NOTES_FILE", file);
    vi.stubEnv("MINDLOG_FILE", join(dir, "mindlog.jsonl"));
    const api = await import("#lib/notes.ts");
    return new IsolatedNotes(dir, file, api);
  }

  async close(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
