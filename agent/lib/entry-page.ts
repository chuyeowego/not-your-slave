import type { MindlogNeighbourhood } from "./mindlog.ts";
import { keyOf } from "./mindlog.ts";
import { MARKDOWN_JS } from "./markdown.ts";
import { FONTS, RENDERED, THEME_BOOTSTRAP, TOKENS } from "./style.ts";

const escape = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const time = (at: string): string => {
  const d = new Date(at);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}`;
};

const entryRow = (entry: MindlogNeighbourhood["entry"], focus: boolean): string => `
    <article class="entry${focus ? " focus" : ""}" data-kind="${escape(entry.kind)}"${focus ? ' id="focus"' : ""}>
      <header>
        ${
          focus
            ? `<span class="at">${escape(time(entry.at))}</span>`
            : `<a class="at" href="/entry/${encodeURIComponent(keyOf(entry))}">${escape(time(entry.at))}</a>`
        }
        <span class="kind">${escape(entry.kind)}</span>
      </header>
      <div class="body" data-text="${escape(entry.text)}"></div>
    </article>`;

export function entryPage(place: MindlogNeighbourhood, origin: string): string {
  const permalink = `${origin}/entry/${encodeURIComponent(keyOf(place.entry))}`;
  const first = place.entry.text.replace(/\s+/g, " ").slice(0, 70);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(place.entry.kind)} · ${escape(first)}</title>
${FONTS}
${THEME_BOOTSTRAP}
<style>
${TOKENS}
${RENDERED}

  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font-family: "Newsreader", Georgia, serif; font-size: 17px; line-height: 1.55;
  }
  .wrap { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  header.top {
    display: flex; align-items: baseline; gap: .8rem; flex-wrap: wrap;
    font-family: var(--mono); font-size: .68rem; letter-spacing: .14em;
    text-transform: uppercase; color: var(--dim); margin-bottom: 2rem;
  }
  header.top a { color: var(--dim); }
  header.top .spacer { flex: 1; }
  button {
    font: inherit; font-family: var(--mono); font-size: .62rem;
    letter-spacing: .12em; text-transform: uppercase;
    background: transparent; color: var(--dim);
    border: 1px solid var(--rule); border-radius: 2px;
    padding: .3rem .6rem; cursor: pointer;
  }
  button:hover { color: var(--hot); border-color: var(--hot); }

  .entry { padding: 1rem 0 1rem 1rem; border-left: 2px solid transparent; opacity: .45; }
  .entry header {
    display: flex; gap: .8rem; align-items: baseline;
    font-family: var(--mono); font-size: .62rem; letter-spacing: .1em;
    text-transform: uppercase; color: var(--dim); margin-bottom: .5rem;
  }
  .entry .body { font-size: .95rem; overflow-wrap: anywhere; }
  .entry .body code, .entry .body pre { background: var(--bg); }
  a.at { color: inherit; text-decoration: none; }
  a.at:hover, a.at:focus-visible { color: var(--hot); text-decoration: underline; }

  .entry.focus {
    opacity: 1; border-left-color: var(--hot);
    background: var(--panel); border-radius: 0 3px 3px 0;
    padding: 1.4rem 1.4rem 1.4rem 1.4rem; margin: 1.6rem 0;
  }
  .entry.focus .body { font-size: 1.1rem; line-height: 1.6; }
  .entry.focus header { color: var(--ink); }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <a href="/">&larr; the agent</a>
    <span class="spacer"></span>
    <button id="copy" type="button" data-url="${escape(permalink)}">copy link</button>
  </header>
${place.before.map((entry) => entryRow(entry, false)).join("\n")}
${entryRow(place.entry, true)}
${place.after.map((entry) => entryRow(entry, false)).join("\n")}
</div>
<script>
${MARKDOWN_JS}

// Text is carried in a data attribute so nothing is parsed as markup on the way in.
for (const host of document.querySelectorAll(".body")) {
  setMessage(host, host.dataset.text ?? "");
}

const copy = document.getElementById("copy");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.url);
      copy.textContent = "copied";
    } catch {
      copy.textContent = "copy failed";
    }
    setTimeout(() => { copy.textContent = "copy link"; }, 2000);
  });
  document.getElementById("focus")?.scrollIntoView({ block: "center" });
</script>
</body>
</html>`;
}
