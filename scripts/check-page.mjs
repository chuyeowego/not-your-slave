// Parses the browser script inside agent/lib/page.ts. The page is a template
// string, so a syntax error in it is invisible to tsc and silently kills every
// interactive part of the UI while the CSS still looks fine.
import vm from "node:vm";

const { PAGE } = await import("../agent/lib/page.ts");
const { entryPage } = await import("../agent/lib/entry-page.ts");

const sample = {
  id: "0123456789ab",
  at: new Date().toISOString(),
  kind: "said",
  text: "**bold**, `code`, https://example.com",
};

const pages = {
  "page.ts": PAGE,
  "entry-page.ts": entryPage({ before: [sample], entry: sample, after: [sample] }, "http://local"),
};

let total = 0;
for (const [name, html] of Object.entries(pages)) {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (blocks.length === 0) {
    console.error(`page check: ${name} has no script blocks`);
    process.exit(1);
  }
  for (const [i, block] of blocks.entries()) {
    // Placeholders the server fills in when serving the page.
    const source = block.replace("__WAKE_PREFIX__", '"woke"');
    try {
      new vm.Script(source, { filename: `${name} script #${i + 1}` });
    } catch (error) {
      console.error(`page check: ${name} script #${i + 1} failed to parse\n${error.message}`);
      process.exit(1);
    }
  }
  total += blocks.length;
}

console.log(`page check: ${total} script blocks parse cleanly across ${Object.keys(pages).length} pages`);
