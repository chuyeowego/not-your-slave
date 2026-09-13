#!/usr/bin/env node
// Run one verification scenario; invoked by verify-nys drive <name>.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { appendRunProof, normalizeCheck, writeScenarioProof } from "../lib/proof-index.mjs";

const HELPERS = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = join(HELPERS, "..");
const SCENARIOS = join(SKILL_ROOT, "scenarios");

const NEED_AI = "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN";
const NEED_VAPID = "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY";

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
const meta = {};
const credentials = {
  ai: state.AI_CREDENTIAL ?? "absent",
  vapid: state.VAPID_CREDENTIAL ?? "absent",
};

const ctx = {
  baseUrl: state.BASE_URL,
  outDir,
  runDir: dirname(state.STATE_FILE),
  state,
  meta,
  hasAi: () => credentials.ai === "present",
  hasVapid: () => credentials.vapid === "present",
  needAi: NEED_AI,
  needVapid: NEED_VAPID,
  check(label, passed, detail = "") {
    checks.push({ label, status: passed ? "pass" : "fail", detail: String(detail) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  },
  blocked(label, need, detail = "") {
    checks.push({ label, status: "blocked", need: String(need), detail: String(detail) });
    console.log(`BLOCKED  ${label} — need ${need}${detail ? ` — ${detail}` : ""}`);
  },
  artifact: (file) => join(outDir, file),
  note(key, value) {
    meta[key] = value;
  },
};

let thrown = null;
try {
  await run(ctx);
} catch (error) {
  thrown = error;
  ctx.check("scenario completed without throwing", false, error.message);
}

const normalized = checks.map(normalizeCheck);
const passed = normalized.filter((c) => c.status === "pass").length;
const failed = normalized.filter((c) => c.status === "fail").length;
const blocked = normalized.filter((c) => c.status === "blocked").length;

const result = {
  scenario: name,
  baseUrl: ctx.baseUrl,
  credentials,
  at: new Date().toISOString(),
  meta,
  checks: normalized,
};
await writeFile(join(outDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);

const driven = meta.driven ?? `verify-nys drive ${name}`;
await writeScenarioProof({
  scenario: name,
  runId: state.RUN_ID,
  baseUrl: ctx.baseUrl,
  credentials,
  checks: normalized,
  meta,
  outDir,
  driven,
});
const runIndex = await appendRunProof({
  evidenceRoot: state.EVIDENCE_DIR ?? join(SKILL_ROOT, "evidence"),
  runId: state.RUN_ID,
  scenario: name,
  credentials,
  checks: normalized,
  meta,
});

console.log(`\n${name}: ${passed} passed, ${failed} failed, ${blocked} blocked`);
console.log(`evidence: ${outDir}`);
console.log(`proof: ${join(outDir, "proof.html")}`);
console.log(`run index: ${runIndex}`);
if (thrown) console.error(thrown.stack);
process.exit(failed === 0 && blocked === 0 && thrown === null ? 0 : 1);
