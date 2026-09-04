import { describe, expect, test } from "vitest";

import { Pwa } from "#lib/pwa.ts";

describe("Pwa assets", () => {
  test("manifest is standalone and uses the existing dark tokens", () => {
    const manifest = JSON.parse(Pwa.manifest()) as {
      display: string;
      start_url: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes?: string }>;
    };
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.theme_color).toBe(Pwa.darkBackground());
    expect(manifest.background_color).toBe(Pwa.darkBackground());
    expect(manifest.theme_color).toBe("#14130f");
    expect(manifest.icons.map((icon) => icon.src)).toEqual(["/icon.svg", "/icon-192.png", "/icon-512.png"]);
  });

  test("service worker receives push and opens /", () => {
    const source = Pwa.serviceWorker();
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain('addEventListener("notificationclick"');
    expect(source).toContain("showNotification");
    expect(source).toContain('openWindow("/")');
    expect(source).toContain("silentIfFocused");
  });

  test("icons are real drawings, not a 1x1 pixel", () => {
    expect(Pwa.iconSvg()).toContain("<svg");
    expect(Pwa.iconSvg()).toContain("#d4622a");
    expect(Pwa.iconSvg().length).toBeGreaterThan(120);

    const png = Pwa.iconPng(192);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.byteLength).toBeGreaterThan(200);
    expect(Pwa.iconPng(192)).toBe(png);
    expect(Pwa.iconPng(512).byteLength).toBeGreaterThan(png.byteLength);
  });
});
