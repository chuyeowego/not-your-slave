import { describe, expect, test } from "vitest";

import { FONTS, RENDERED, TOKENS } from "#lib/style.ts";

describe("style tokens", () => {
  test("defines the shared palette once, including both schemes", () => {
    for (const token of ["--ink", "--bg", "--panel", "--hot", "--cool", "--think", "--note", "--mono"]) {
      expect(TOKENS).toContain(token);
    }
    expect(TOKENS).toContain("color-scheme: light dark");
    expect(TOKENS).toContain(':root[data-theme="light"]');
    expect(TOKENS).toContain(':root[data-theme="dark"]');
    expect(TOKENS).toContain("light-dark(");
  });

  test("loads the two faces the pages share", () => {
    expect(FONTS).toContain("Newsreader");
    expect(FONTS).toContain("JetBrains+Mono");
    expect(FONTS).toContain("fonts.googleapis.com");
  });

  test("keeps pic layout in the shared sheet", () => {
    expect(RENDERED).toContain(".msg .pics, .entry .pics");
    expect(RENDERED).toContain(".msg .pic, .entry .pic");
  });
});
