import { describe, expect, test } from "vitest";

import { MARKDOWN_JS } from "#lib/markdown.ts";
import { Markdown, MiniDocument } from "./helpers/mini-dom.ts";

describe("MARKDOWN_JS renderer", () => {
  test("renders paragraphs, emphasis, code, and safe links", () => {
    const html = MiniDocument.html(
      Markdown.render(MARKDOWN_JS, "see **bold** and *italic* and `code` plus [docs](https://eve.dev) and https://example.com/x."),
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('href="https://eve.dev"');
    expect(html).toContain(">docs</a>");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain(".</p>");
  });

  test("keeps stray markup as text", () => {
    const body = Markdown.render(MARKDOWN_JS, "a <script>alert(1)</script> tag");
    const tags = body.childNodes.flatMap((child) => (typeof child === "string" ? [] : [child.tagName]));
    expect(tags).toEqual(["P"]);
    expect(MiniDocument.html(body)).toContain("a <script>alert(1)</script> tag");
  });

  test("does not turn javascript: into a link", () => {
    const html = MiniDocument.html(Markdown.render(MARKDOWN_JS, "go javascript:alert(1) now"));
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("javascript:alert(1)");
  });

  test("builds lists, headings, and fenced blocks", () => {
    const html = MiniDocument.html(
      Markdown.render(
        MARKDOWN_JS,
        ["# Title", "", "- one", "- two", "", "1. first", "", "```", "raw <b>", "```"].join("\n"),
      ),
    );
    expect(html).toContain('<p class="head">Title</p>');
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<pre>raw <b></pre>");
  });

  test("blank lines break paragraphs", () => {
    const html = MiniDocument.html(Markdown.render(MARKDOWN_JS, "one\n\ntwo"));
    expect(html).toBe("<div><p>one</p><p>two</p></div>");
  });
});
