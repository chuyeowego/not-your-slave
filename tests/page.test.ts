import vm from "node:vm";

import { describe, expect, test } from "vitest";

import { PAGE } from "#lib/page.ts";

describe("PAGE", () => {
  test("is a complete document with chat, mindlog, and the wake placeholder", () => {
    expect(PAGE.startsWith("<!doctype html>")).toBe(true);
    expect(PAGE).toContain("An agent that thinks for itself");
    expect(PAGE).toContain('id="composer"');
    expect(PAGE).toContain('id="mindlog"');
    expect(PAGE).toContain('id="think"');
    expect(PAGE).toContain("Wake it");
    expect(PAGE).toContain("const WAKE_PREFIX = __WAKE_PREFIX__;");
    expect(PAGE).toContain("/api/say");
    expect(PAGE).toContain("/api/mindlog");
    expect(PAGE).toContain("/api/think");
    expect(PAGE).toContain("/api/session");
    expect(PAGE).toContain('rel="manifest"');
    expect(PAGE).toContain("/manifest.webmanifest");
    expect(PAGE).toContain('id="notify"');
    expect(PAGE).toContain("/sw.js");
    expect(PAGE).toContain("viewport-fit=cover");
    expect(PAGE).toContain("safe-area-inset");
    expect(PAGE).toContain("Add to Home Screen");
  });

  test("inlined scripts parse once the server placeholder is filled", () => {
    const blocks = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const [index, block] of blocks.entries()) {
      const source = block.replace("__WAKE_PREFIX__", '"woke"');
      expect(() => new vm.Script(source, { filename: `page.ts script #${index + 1}` })).not.toThrow();
    }
  });
});
