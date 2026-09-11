import vm from "node:vm";

import { describe, expect, test } from "vitest";

import { Pwa } from "#lib/pwa.ts";

async function deliverPush(
  data: { json: () => unknown } | null,
  focused: boolean,
): Promise<{ shown: Array<{ title: string }>; error: string | null }> {
  const shown: Array<{ title: string }> = [];
  const handlers: Record<string, Array<(event: unknown) => void>> = {};
  const sandbox: { self: object; console: Console } = { self: {}, console };
  sandbox.self = {
    addEventListener(type: string, fn: (event: unknown) => void) {
      (handlers[type] ??= []).push(fn);
    },
    skipWaiting() {},
    clients: {
      async matchAll() {
        return focused ? [{ focused: true, url: "http://local/" }] : [];
      },
    },
    registration: {
      async showNotification(title: string) {
        shown.push({ title });
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(Pwa.serviceWorker(), sandbox);
  let waiter: Promise<unknown> | undefined;
  const event = {
    data,
    waitUntil(value: unknown) {
      waiter = Promise.resolve(value);
    },
  };
  for (const fn of handlers.push ?? []) fn(event);
  let error: string | null = null;
  try {
    await waiter;
  } catch (caught) {
    error = String(caught);
  }
  return { shown, error };
}

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
  });

  test("a push event always shows a notification, even on a focused window", async () => {
    const payload = {
      title: "it said something",
      body: "hello",
    };
    const focused = await deliverPush({ json: () => payload }, true);
    expect(focused.error).toBeNull();
    expect(focused.shown).toEqual([{ title: "it said something" }]);

    const testPush = await deliverPush(
      { json: () => ({ title: "not-your-slave", body: "push is on" }) },
      true,
    );
    expect(testPush.shown).toEqual([{ title: "not-your-slave" }]);
  });

  test("a malformed push payload still shows a notification", async () => {
    const result = await deliverPush(
      {
        json: () => {
          throw new SyntaxError("JSON.parse: unexpected character");
        },
      },
      true,
    );
    expect(result.error).toBeNull();
    expect(result.shown).toHaveLength(1);
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
