import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { vi } from "vitest";

export type MindlogApi = typeof import("#lib/mindlog.ts");

/** Fresh temp file store + module graph, so FILE and the postgres client cannot leak. */
export class IsolatedMindlog {
  private constructor(
    readonly dir: string,
    readonly file: string,
    readonly api: MindlogApi,
  ) {}

  static async open(): Promise<IsolatedMindlog> {
    const dir = await mkdtemp(join(tmpdir(), "nys-mindlog-"));
    const file = join(dir, "mindlog.jsonl");
    vi.resetModules();
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    vi.stubEnv("MINDLOG_FILE", file);
    const api = await import("#lib/mindlog.ts");
    return new IsolatedMindlog(dir, file, api);
  }

  async close(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}

/** Advance the clock past the current millisecond so ISO timestamps can differ. */
export class Clock {
  static async nextMs(): Promise<void> {
    const start = Date.now();
    while (Date.now() === start) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
}
