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
