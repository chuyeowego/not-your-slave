import { describe, expect, test } from "vitest";

import { capOutputTokens, promptHasImage } from "#agent.ts";

const transform = (prompt: unknown, extra?: Record<string, unknown>) =>
  capOutputTokens.transformParams!({
    type: "generate",
    model: {} as never,
    params: { prompt, maxOutputTokens: 8000, ...extra } as never,
  });

describe("promptHasImage", () => {
  test("is false for text-only turns", () => {
    expect(promptHasImage([{ role: "user", content: [{ type: "text", text: "hi" }] }])).toBe(false);
    expect(promptHasImage("hello")).toBe(false);
  });

  test("is true for image file parts and legacy image parts", () => {
    expect(
      promptHasImage([
        { role: "user", content: [{ type: "file", mediaType: "image/png", data: "abc" }] },
      ]),
    ).toBe(true);
    expect(promptHasImage([{ role: "user", content: [{ type: "image", image: "abc" }] }])).toBe(true);
    expect(
      promptHasImage([
        { role: "user", content: [{ type: "file", mediaType: "application/pdf", data: "abc" }] },
      ]),
    ).toBe(false);
  });
});

describe("capOutputTokens", () => {
  test("caps output and leaves text-only routing alone", async () => {
    const next = await transform([{ role: "user", content: [{ type: "text", text: "hi" }] }]);
    expect(next.maxOutputTokens).toBe(4096);
    expect(next.providerOptions).toBeUndefined();
  });

  test("asks the gateway for a vision route when the prompt has an image", async () => {
    const next = await transform(
      [{ role: "user", content: [{ type: "file", mediaType: "image/jpeg", data: "abc" }] }],
      { providerOptions: { gateway: { tags: ["home"] } } },
    );
    expect(next.maxOutputTokens).toBe(4096);
    expect(next.providerOptions).toEqual({ gateway: { tags: ["home"], has: ["vision"] } });
  });
});
