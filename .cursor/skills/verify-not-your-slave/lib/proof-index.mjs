// Human-glanceable proof page per scenario run; also aggregates a run-level index.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/** Relative from evidence/_runs/<run-id>/proof.html → evidence/<scenario>/<run-id>/proof.html */
export function scenarioProofHref(scenario, runId) {
  return `../../${scenario}/${runId}/proof.html`;
}

/** Relative from evidence/<scenario>/<run-id>/proof.html → evidence/_runs/<run-id>/proof.html */
export function runProofHref(runId) {
  return `../../_runs/${runId}/proof.html`;
}

/** Resolve a rollup href the way file:// would (for sanity checks). */
export function resolveProofHref(rollupPath, href) {
  return resolve(dirname(rollupPath), href);
}

const PROOF_STYLES = `
    body { font-family: system-ui, sans-serif; margin: 1.5rem; max-width: 960px; }
    h1 { font-size: 1.25rem; }
    h2 { font-size: 1.05rem; margin-top: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
    tr.pass td:first-child { color: #0a7; font-weight: 600; }
    tr.fail td:first-child { color: #c00; font-weight: 600; }
    tr.blocked td:first-child { color: #b8860b; font-weight: 600; }
    figure { display: inline-block; margin: 0.5rem 1rem 1rem 0; vertical-align: top; }
    img { max-width: 320px; border: 1px solid #ddd; }
    figcaption { font-size: 0.85rem; color: #555; margin-top: 0.25rem; }
    code { font-size: 0.9em; word-break: break-all; }
    .summary { padding: 0.75rem 1rem; background: #f6f6f6; border-radius: 6px; margin: 1rem 0; }
    .credentials { padding: 0.75rem 1rem; background: #f0f4ff; border-radius: 6px; margin: 1rem 0; font-size: 0.92rem; }
    .credentials dt { font-weight: 600; margin-top: 0.35rem; }
    .credentials dd { margin: 0.15rem 0 0.35rem 0; }
`;

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeCheck(check) {
  if (check.status) {
    return {
      label: check.label,
      status: check.status,
      detail: check.detail ?? "",
      need: check.need ?? "",
    };
  }
  return {
    label: String(check.label ?? ""),
    status: check.passed ? "pass" : "fail",
    detail: check.detail ?? "",
    need: check.need ?? "",
  };
}

function summarizeChecks(checks) {
  const normalized = checks.map(normalizeCheck);
  const passed = normalized.filter((c) => c.status === "pass").length;
  const failed = normalized.filter((c) => c.status === "fail").length;
  const blocked = normalized.filter((c) => c.status === "blocked").length;
  return { normalized, passed, failed, blocked };
}

function credentialsHtml(credentials = {}) {
  const ai = credentials.ai === "present" ? "present" : "absent";
  const vapid = credentials.vapid === "present" ? "present" : "absent";
  return `<div class="credentials"><strong>Credentials</strong> (from doctor — not a grade)
<dl>
  <dt>AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN</dt><dd>${esc(ai)} — required for live model replies and agent <code>said</code>/<code>thought</code></dd>
  <dt>VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY</dt><dd>${esc(vapid)} — required for <code>push-notify</code> (headed Chrome)</dd>
</dl>
<p>Each check is <strong>passed</strong>, <strong>failed</strong>, or <strong>blocked</strong> (missing credential — set the env var and re-run).</p></div>`;
}

function checkRows(checks) {
  const { normalized } = summarizeChecks(checks);
  return normalized
    .map((c) => {
      const rowClass = c.status === "pass" ? "pass" : c.status === "blocked" ? "blocked" : "fail";
      const status = c.status.toUpperCase();
      const detail = c.status === "blocked" && c.need ? `need ${c.need}${c.detail ? ` — ${c.detail}` : ""}` : c.detail;
      return `<tr class="${rowClass}"><td>${status}</td><td>${esc(c.label)}</td><td>${esc(detail)}</td></tr>`;
    })
    .join("\n");
}

function imageRows(files) {
  const pngs = files.filter((f) => f.endsWith(".png")).sort();
  if (pngs.length === 0) return "<p><em>No screenshots captured.</em></p>";
  return pngs
    .map(
      (name) =>
        `<figure><img src="${esc(name)}" alt="${esc(name)}"/><figcaption>${esc(name)}</figcaption></figure>`,
    )
    .join("\n");
}

function metaRows(meta) {
  const entries = Object.entries(meta ?? {}).filter(([k]) => k !== "driven");
  if (entries.length === 0) return "";
  return `<h2>Run metadata</h2><table><tbody>${entries
    .map(([k, v]) => `<tr><th>${esc(k)}</th><td><code>${esc(v)}</code></td></tr>`)
    .join("")}</tbody></table>`;
}

function checkTableHead() {
  return `<thead><tr><th></th><th>Check</th><th>Detail</th></tr></thead>`;
}

export async function writeScenarioProof({
  scenario,
  runId,
  baseUrl,
  credentials,
  checks,
  meta,
  outDir,
  driven,
}) {
  const files = await readdir(outDir);
  const { passed, failed, blocked } = summarizeChecks(checks);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${esc(scenario)} — ${esc(runId)}</title>
  <style>${PROOF_STYLES}</style>
</head>
<body>
  <h1>${esc(scenario)} <small>(${esc(runId)})</small></h1>
  ${credentialsHtml(credentials)}
  <div class="summary">
    <p><strong>Base URL:</strong> <code>${esc(baseUrl)}</code></p>
    <p><strong>Driven:</strong> ${esc(driven)}</p>
    <p><strong>Result:</strong> ${passed} passed, ${failed} failed, ${blocked} blocked</p>
    <p><a href="${esc(runProofHref(runId))}">← Back to run rollup</a></p>
  </div>
  ${metaRows(meta)}
  <h2>Checks</h2>
  <table>${checkTableHead()}<tbody>
  ${checkRows(checks)}
  </tbody></table>
  <h2>Screenshots</h2>
  ${imageRows(files)}
  <h2>Artifacts</h2>
  <ul>${files
    .filter((f) => f !== "proof.html")
    .map((f) => `<li><a href="${esc(f)}">${esc(f)}</a></li>`)
    .join("")}</ul>
</body>
</html>
`;
  await writeFile(join(outDir, "proof.html"), html);
}

function scenarioSection({ scenario, runId, checks, meta }) {
  const { passed, failed, blocked } = summarizeChecks(checks);
  const href = scenarioProofHref(scenario, runId);
  return `
<section id="${esc(scenario)}">
  <h2><a href="${esc(href)}">${esc(scenario)}</a></h2>
  <p>${passed} passed, ${failed} failed, ${blocked} blocked</p>
  ${meta?.marker ? `<p>Marker: <code>${esc(meta.marker)}</code></p>` : ""}
  ${meta?.sessionIdAfterReload !== undefined ? `<p>sessionId after reload: <code>${esc(meta.sessionIdAfterReload)}</code></p>` : ""}
  <table>${checkTableHead()}<tbody>${checkRows(checks)}</tbody></table>
</section>`;
}

export async function appendRunProof({ evidenceRoot, runId, scenario, credentials, checks, meta }) {
  const runDir = join(evidenceRoot, "_runs", runId);
  await mkdir(runDir, { recursive: true });
  const indexPath = join(runDir, "proof.html");

  const section = scenarioSection({ scenario, runId, checks, meta });

  let body;
  try {
    body = await readFile(indexPath, "utf8");
    if (!body.includes("<strong>Credentials</strong>")) {
      body = body.replace("<body>", `<body>\n${credentialsHtml(credentials)}`);
    }
    body = body.replace("</body>", `${section}\n</body>`);
  } catch {
    body = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>verify-nys ${esc(runId)}</title>
<style>${PROOF_STYLES}</style>
</head><body><h1>Verification run: ${esc(runId)}</h1>
${credentialsHtml(credentials)}
${section}</body></html>`;
  }
  await writeFile(indexPath, body);
  return indexPath;
}
