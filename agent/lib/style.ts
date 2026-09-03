// The palette, shared by the app page and the permalink page so a colour is
// only ever defined once. light-dark() picks per token from the element's
// color-scheme, so the theme toggle only has to set that scheme.
export const TOKENS = String.raw`
  :root {
    color-scheme: light dark;
    --ink: light-dark(#1b1a15, #e8e3d8);
    --dim: light-dark(#6d6757, #8b8579);
    --faint: light-dark(#a8a294, #4a463e);
    --bg: light-dark(#eeece4, #14130f);
    --panel: light-dark(#f8f7f2, #1b1a15);
    --rule: light-dark(#dad5c8, #2c2a23);
    --hot: light-dark(#a8481a, #d4622a);
    --cool: light-dark(#46683f, #6f8f6a);
    --think: light-dark(#56488c, #8a7fb8);
    --note: light-dark(#7d5f0c, #c9a227);
    --mono: "JetBrains Mono", ui-monospace, monospace;
  }
  :root[data-theme="light"] { color-scheme: light; }
  :root[data-theme="dark"] { color-scheme: dark; }
`;

export const FONTS = String.raw`<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />`;

// Both pages stamp a saved scheme on :root before the first paint.
export const THEME_BOOTSTRAP = String.raw`<script>
  try {
    const saved = localStorage.getItem("nys.theme");
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  } catch {}
</script>`;

// Rendered-body typography and kind colours. Shared selectors already exist
// on both documents; backgrounds and conversation/permalink extras stay local.
export const RENDERED = String.raw`
  .body > * { margin: 0 0 .6rem; }
  .body > *:last-child { margin-bottom: 0; }
  .body p { white-space: pre-wrap; }
  .body p.head { font-weight: 600; }
  .body ul, .body ol { padding-left: 1.4rem; }
  .body li { margin: 0 0 .3rem; }
  .body a { color: var(--hot); text-underline-offset: 2px; }
  .body code {
    font-family: var(--mono); font-size: .82em;
    border: 1px solid var(--rule); border-radius: 2px;
    padding: .05em .3em;
  }
  .body pre {
    font-family: var(--mono); font-size: .78rem;
    border: 1px solid var(--rule); border-radius: 2px;
    padding: .7rem .8rem; overflow-x: auto; white-space: pre;
  }

  .entry[data-kind="heard"] .kind { color: var(--hot); }
  .entry[data-kind="said"] .kind { color: var(--cool); }
  .entry[data-kind="thought"] .kind { color: var(--think); }
  .entry[data-kind="thought"] .text { color: var(--ink); font-style: italic; }
  .entry[data-kind="thought"] .body { font-style: italic; }
  .entry[data-kind="note"] .kind, .entry[data-kind="note"] .text { color: var(--note); }
  .entry[data-kind="did"] .kind { color: var(--faint); }
  .entry[data-kind="woke"] .kind, .entry[data-kind="woke"] .text { color: var(--think); }
`;
