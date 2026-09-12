#!/usr/bin/env node
// Runs one scenario against a launched instance and writes its evidence.
//
//   node bin/drive.mjs <scenario> [--port N] [--run-dir DIR]
//   node bin/drive.mjs --list
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENARIOS = join(HERE, "..", "scenarios");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const listed = (await readdir(SCENARIOS)).filter((file) => file.endsWith(".mjs")).map((file) => file.slice(0, -4));

if (args.includes("--list") || args.length === 0) {
  console.log(listed.join("\n"));
  process.exit(args.length === 0 ? 2 : 0);
}

const name = args[0];
if (!listed.includes(name)) {
  console.error(`unknown scenario "${name}". Available:\n  ${listed.join("\n  ")}`);
  process.exit(2);
}

const runDir = flag("run-dir", process.env.NYS_RUN_DIR ?? "/tmp/nys-verify/adhoc");

// The run dir records the port its launch took. Without this, driving a run
// that chose a non-default port silently exercises whatever holds 2999.
const recordedPort = await readFile(join(runDir, "port"), "utf8").catch(() => "");
const port = Number(flag("port", process.env.NYS_PORT ?? recordedPort.trim() ?? "") || 2999);
const outDir = join(runDir, name);
await mkdir(outDir, { recursive: true });

const { run } = await import(join(SCENARIOS, `${name}.mjs`));

const checks = [];
const ctx = {
  baseUrl: `http://127.0.0.1:${port}`,
  outDir,
  runDir,
  /** Record one pass/fail predicate. The scenario fails if any check fails. */
  check(label, passed, detail = "") {
    checks.push({ label, passed: Boolean(passed), detail: String(detail) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  },
  artifact: (file) => join(outDir, file),
};

let thrown = null;
try {
  await run(ctx);
} catch (error) {
  thrown = error;
  ctx.check("scenario completed without throwing", false, error.message);
}

const failed = checks.filter((entry) => !entry.passed);
await writeFile(
  join(outDir, "result.json"),
  `${JSON.stringify({ scenario: name, baseUrl: ctx.baseUrl, at: new Date().toISOString(), checks }, null, 2)}\n`,
);

console.log(`\n${name}: ${checks.length - failed.length}/${checks.length} checks passed`);
console.log(`evidence: ${outDir}`);
if (thrown) console.error(thrown.stack);
process.exit(failed.length === 0 && thrown === null ? 0 : 1);
