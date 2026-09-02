export interface MemoryRow {
  id: number;
  entry_id: string | null;
  at: Date;
  kind: string;
  text: string;
  session_id: string | null;
}

type InsertFragment = { readonly __insert: Record<string, unknown> };

/** In-memory stand-in for the `postgres` tagged-template client mindlog.ts uses. */
export class MemoryPostgres {
  readonly rows: MemoryRow[] = [];
  private nextId = 1;
  private nextAt = Date.now();

  readonly tag: {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
    (values: Record<string, unknown>): InsertFragment;
  };

  constructor() {
    const run = (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]> =>
      Promise.resolve(this.query(strings, values));
    const helper = (values: Record<string, unknown>): InsertFragment => ({ __insert: values });
    this.tag = ((first: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
      if (MemoryPostgres.isTemplate(first)) return run(first, ...values);
      return helper(first);
    }) as MemoryPostgres["tag"];
  }

  private static isTemplate(value: unknown): value is TemplateStringsArray {
    return Array.isArray(value) && "raw" in value;
  }

  private static asRecord(row: MemoryRow): Record<string, unknown> {
    return { ...row };
  }

  private static sqlText(strings: TemplateStringsArray): string {
    return strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  private query(strings: TemplateStringsArray, values: unknown[]): Array<Record<string, unknown>> {
    const sql = MemoryPostgres.sqlText(strings);

    if (sql.startsWith("create table") || sql.startsWith("alter table") || sql.startsWith("create index")) {
      return [];
    }

    if (sql.includes("insert into mindlog")) {
      const fragment = values[0];
      const data =
        fragment !== null && typeof fragment === "object" && "__insert" in fragment
          ? (fragment as InsertFragment).__insert
          : (fragment as Record<string, unknown>);
      this.rows.push({
        id: this.nextId++,
        entry_id: (data.entry_id as string | null | undefined) ?? null,
        at: new Date(this.nextAt++),
        kind: String(data.kind),
        text: String(data.text),
        session_id: (data.session_id as string | null | undefined) ?? null,
      });
      return [];
    }

    if (sql.includes("count(*)")) {
      const last = this.rows.length === 0 ? 0 : this.rows[this.rows.length - 1].id;
      return [{ n: this.rows.length, last }];
    }

    if (sql.includes("where entry_id =")) {
      const key = String(values[0]);
      const found = this.rows.find((row) => row.entry_id === key);
      return found === undefined ? [] : [MemoryPostgres.asRecord(found)];
    }

    if (sql.includes("date_trunc")) {
      const key = String(values[0]);
      const ms = Date.parse(key);
      const found = this.rows.find((row) => row.at.getTime() === ms);
      return found === undefined ? [] : [MemoryPostgres.asRecord(found)];
    }

    if (sql.includes("where id <")) {
      const seq = Number(values[0]);
      const limit = Number(values[1]);
      return this.rows
        .filter((row) => row.id < seq)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(MemoryPostgres.asRecord);
    }

    if (sql.includes("where id >")) {
      const seq = Number(values[0]);
      const limit = Number(values[1]);
      return this.rows
        .filter((row) => row.id > seq)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map(MemoryPostgres.asRecord);
    }

    if (sql.includes("text ilike")) {
      const pattern = String(values[0]);
      const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase();
      const limit = Number(values[1]);
      return this.rows
        .filter((row) => row.text.toLowerCase().includes(needle))
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(MemoryPostgres.asRecord);
    }

    if (sql.includes("where at <")) {
      const before = new Date(String(values[0]));
      const limit = Number(values[1]);
      return this.rows
        .filter((row) => row.at < before)
        .sort((a, b) => b.id - a.id)
        .slice(0, limit)
        .map(MemoryPostgres.asRecord);
    }

    if (sql.includes("order by id desc")) {
      const limit = Number(values[0]);
      return [...this.rows].sort((a, b) => b.id - a.id).slice(0, limit).map(MemoryPostgres.asRecord);
    }

    throw new Error(`MemoryPostgres: unhandled SQL: ${sql}`);
  }
}
