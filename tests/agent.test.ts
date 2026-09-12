import { describe, expect, test } from "vitest";

import { capOutputTokens, IMAGE_TURN_REMINDER, promptForVision, promptHasImage } from "#agent.ts";

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

describe("promptForVision", () => {
  test("leaves text-only prompts alone", () => {
    const prompt = [{ role: "user", content: [{ type: "text", text: "hi" }] }];
    expect(promptForVision(prompt)).toBe(prompt);
  });

  test("replaces the caption-less stub and strips sandbox attachment paths", () => {
    expect(
      promptForVision([
        {
          role: "user",
          content: [
            { type: "text", text: "(image)" },
            {
              type: "file",
              data: "abc",
              filename: "/workspace/attachments/deadbeef/account.png",
              mediaType: "image/png",
            },
          ],
        },
      ]),
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: IMAGE_TURN_REMINDER },
          { type: "file", data: "abc", mediaType: "image/png" },
        ],
      },
    ]);
  });

  test("prepends the reminder when they already wrote a caption", () => {
    expect(
      promptForVision([
        {
          role: "user",
          content: [
            { type: "text", text: "what is this account" },
            { type: "file", data: "abc", filename: "shot.png", mediaType: "image/jpeg" },
          ],
        },
      ]),
    ).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: IMAGE_TURN_REMINDER },
          { type: "text", text: "what is this account" },
          { type: "file", data: "abc", filename: "shot.png", mediaType: "image/jpeg" },
        ],
      },
    ]);
  });

  test("does not stack the reminder on a later generate", () => {
    const once = promptForVision([
      {
        role: "user",
        content: [
          { type: "text", text: IMAGE_TURN_REMINDER },
          { type: "file", data: "abc", mediaType: "image/png" },
        ],
      },
    ]);
    expect(promptForVision(once)).toEqual(once);
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
      [
        {
          role: "user",
          content: [
            { type: "text", text: "(image)" },
            {
              type: "file",
              data: "abc",
              filename: "/workspace/attachments/aa/account.png",
              mediaType: "image/jpeg",
            },
          ],
        },
      ],
      { providerOptions: { gateway: { tags: ["home"] } } },
    );
    expect(next.maxOutputTokens).toBe(4096);
    expect(next.providerOptions).toEqual({ gateway: { tags: ["home"], has: ["vision"] } });
    expect(next.prompt).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: IMAGE_TURN_REMINDER },
          { type: "file", data: "abc", mediaType: "image/jpeg" },
        ],
      },
    ]);
  });
});
