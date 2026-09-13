#!/usr/bin/env node
// Run one verification scenario; invoked by verify-nys drive <name>.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HELPERS = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HELPERS, "..");
const SCENARIOS = join(SKILL_ROOT, "scenarios");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

async function loadState() {
  const stateFile = process.env.STATE_FILE ?? flag("state-file", "");
  if (!stateFile) throw new Error("STATE_FILE not set (run verify-nys launch first)");
  const text = await readFile(stateFile, "utf8");
  const state = {};
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) state[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return state;
}

const listed = (await readdir(SCENARIOS)).filter((file) => file.endsWith(".mjs")).map((file) => file.slice(0, -4));

if (args.includes("--list")) {
  console.log(listed.join("\n"));
  process.exit(0);
}

const name = args.find((arg) => !arg.startsWith("--"));
if (!name || !listed.includes(name)) {
  console.error(`unknown scenario "${name ?? ""}". Available:\n  ${listed.join("\n  ")}`);
  process.exit(2);
}

const state = await loadState();
const outDir = join(state.EVIDENCE_DIR ?? join(SKILL_ROOT, "evidence"), name, state.RUN_ID);
await mkdir(outDir, { recursive: true });

const { run } = await import(join(SCENARIOS, `${name}.mjs`));

const checks = [];
const ctx = {
  baseUrl: state.BASE_URL,
  outDir,
  runDir: dirname(state.STATE_FILE),
  state,
  tier: tierOf(state),
  check(label, passed, detail = "") {
    checks.push({ label, passed: Boolean(passed), detail: String(detail) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  },
  artifact: (file) => join(outDir, file),
};

function tierOf(state) {
  if (state.AI_CREDENTIAL === "present") return "B";
  return "A";
}

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
  `${JSON.stringify({ scenario: name, baseUrl: ctx.baseUrl, tier: ctx.tier, at: new Date().toISOString(), checks }, null, 2)}\n`,
);

console.log(`\n${name}: ${checks.length - failed.length}/${checks.length} checks passed (tier ${ctx.tier})`);
console.log(`evidence: ${outDir}`);
if (thrown) console.error(thrown.stack);
process.exit(failed.length === 0 && thrown === null ? 0 : 1);
