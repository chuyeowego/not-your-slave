import vm from "node:vm";

import { describe, expect, test } from "vitest";

import { entryPage } from "#lib/entry-page.ts";
import type { MindlogNeighbourhood } from "#lib/mindlog.ts";

const sample = {
  id: "0123456789ab",
  at: "2024-05-01T12:34:56.000Z",
  kind: "said" as const,
  text: "**bold**, `code`, https://example.com",
};

const place: MindlogNeighbourhood = {
  before: [{ ...sample, id: "aaaaaaaaaaaa", text: "earlier <note>" }],
  entry: { ...sample, text: 'focus & "quote"' },
  after: [{ ...sample, id: "bbbbbbbbbbbb", kind: "heard", text: "later" }],
};

describe("entryPage", () => {
  const html = entryPage(place, "http://local");

  test("escapes text in title, attributes, and neighbour markup", () => {
    expect(html).toContain("<title>said · focus &#38; &#34;quote&#34;</title>");
    expect(html).toContain("focus &#38; &#34;quote&#34;");
    expect(html).toContain("earlier &#60;note&#62;");
    expect(html).not.toContain("earlier <note>");
    expect(html).not.toContain('focus & "quote"');
  });

  test("marks the subject and links neighbours", () => {
    expect(html).toContain('class="entry focus"');
    expect(html).toContain('id="focus"');
    expect(html).toContain('data-kind="said"');
    expect(html).toContain("/entry/aaaaaaaaaaaa");
    expect(html).toContain("/entry/bbbbbbbbbbbb");
    expect(html).toContain("http://local/entry/0123456789ab");
    expect(html).toMatch(/<a class="at" href="\/entry\/aaaaaaaaaaaa">/);
    expect(html).not.toMatch(/<a class="at" href="\/entry\/0123456789ab">/);
  });

  test("inlined scripts parse as JavaScript", () => {
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const [index, block] of blocks.entries()) {
      expect(() => new vm.Script(block, { filename: `entry-page script #${index + 1}` })).not.toThrow();
    }
  });
});
