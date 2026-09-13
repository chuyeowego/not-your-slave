import { describe, expect, test } from "vitest";

import { capOutputTokens } from "#agent.ts";
import { SAY } from "#lib/say.ts";

const transform = (prompt: unknown, extra?: Record<string, unknown>) =>
  capOutputTokens.transformParams!({
    type: "generate",
    model: {} as never,
    params: { prompt, maxOutputTokens: 8000, ...extra } as never,
  });

const firstText = (prompt: unknown): string => {
  const part = (prompt as { content: { text?: unknown; type?: unknown }[] }[])[0]?.content.find(
    (item) => item.type === "text",
  );
  if (typeof part?.text !== "string") throw new Error("expected a text part");
  return part.text;
};

describe("capOutputTokens", () => {
  test("caps output and leaves text-only routing alone", async () => {
    const prompt = [{ role: "user", content: [{ type: "text", text: "hi" }] }];
    const next = await transform(prompt);
    expect(next.maxOutputTokens).toBe(4096);
    expect(next.providerOptions).toBeUndefined();
    expect(next.prompt).toBe(prompt);

    const stringPrompt = await transform("hello");
    expect(stringPrompt.providerOptions).toBeUndefined();
    expect(stringPrompt.prompt).toBe("hello");
  });

  test("asks the gateway for a vision route when the prompt has an image", async () => {
    const next = await transform(
      [
        {
          role: "user",
          content: [
            { type: "text", text: SAY.untitled },
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
    expect(firstText(next.prompt)).not.toBe(SAY.untitled);
    expect(firstText(next.prompt)).toContain("already see this photograph");
    expect(next.prompt).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: firstText(next.prompt) },
          { type: "file", data: "abc", mediaType: "image/jpeg" },
        ],
      },
    ]);
  });

  test("treats legacy image parts as vision and ignores non-image files", async () => {
    const image = await transform([{ role: "user", content: [{ type: "image", image: "abc" }] }]);
    expect(image.providerOptions).toEqual({ gateway: { has: ["vision"] } });

    const pdf = await transform([
      { role: "user", content: [{ type: "file", mediaType: "application/pdf", data: "abc" }] },
    ]);
    expect(pdf.providerOptions).toBeUndefined();
  });

  test("prepends a vision cue when they already wrote a caption", async () => {
    const next = await transform([
      {
        role: "user",
        content: [
          { type: "text", text: "what is this account" },
          { type: "file", data: "abc", filename: "shot.png", mediaType: "image/jpeg" },
        ],
      },
    ]);
    expect((next.prompt as { content: unknown[] }[])[0]?.content).toEqual([
      { type: "text", text: firstText(next.prompt) },
      { type: "text", text: "what is this account" },
      { type: "file", data: "abc", filename: "shot.png", mediaType: "image/jpeg" },
    ]);
  });

  test("does not stack the vision cue on a later generate", async () => {
    const once = await transform([
      {
        role: "user",
        content: [
          { type: "text", text: SAY.untitled },
          { type: "file", data: "abc", mediaType: "image/png" },
        ],
      },
    ]);
    const again = await transform(once.prompt);
    expect(again.prompt).toEqual(once.prompt);
  });
});
