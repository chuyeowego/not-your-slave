// Parses the browser script inside agent/lib/page.ts. The page is a template
// string, so a syntax error in it is invisible to tsc and silently kills every
// interactive part of the UI while the CSS still looks fine.
import vm from "node:vm";

const { PAGE } = await import("../agent/lib/page.ts");
const blocks = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

if (blocks.length === 0) {
  console.error("page check: no script blocks found");
  process.exit(1);
}

for (const [i, block] of blocks.entries()) {
  // Placeholders the server fills in when serving the page.
  const source = block.replace("__WAKE_PREFIX__", '"woke"');
  try {
    new vm.Script(source, { filename: `page.ts script #${i + 1}` });
  } catch (error) {
    console.error(`page check: script #${i + 1} failed to parse\n${error.message}`);
    process.exit(1);
  }
}

console.log(`page check: ${blocks.length} script blocks parse cleanly`);
