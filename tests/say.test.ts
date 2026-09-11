import { describe, expect, test } from "vitest";

import { parseSay, SAY, toUserContent, type SayResult } from "#lib/say.ts";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

const say = (init: RequestInit): Promise<SayResult> =>
  parseSay(new Request("http://local/api/say", { method: "POST", ...init }));

describe("parseSay", () => {
  test("keeps JSON text-only as a string turn", async () => {
    const parsed = await say({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "  hello  " }),
    });
    expect(parsed).toEqual({ ok: true, value: { text: "hello", images: [] } });
    if (parsed.ok) expect(toUserContent(parsed.value)).toBe("hello");
  });

  test("rejects an empty JSON message the way /api/say used to", async () => {
    const parsed = await say({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });
    expect(parsed).toEqual({ ok: false, error: "message required" });
  });

  test("accepts a data URL image without caption", async () => {
    const parsed = await say({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        images: [{ data: `data:image/png;base64,${Buffer.from(png).toString("base64")}`, filename: "a.png" }],
      }),
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.text).toBe("");
    expect(parsed.value.images).toHaveLength(1);
    expect(parsed.value.images[0]).toMatchObject({ filename: "a.png", mediaType: "image/png" });
    expect(parsed.value.images[0]?.bytes).toEqual(png);
    expect(toUserContent(parsed.value)).toEqual([
      { type: "file", data: png, filename: "a.png", mediaType: "image/png" },
    ]);
  });

  test("multipart mixes caption and files, and infers jpeg from a .jpg name", async () => {
    const form = new FormData();
    form.set("message", "what is this");
    form.append("images", new File([png], "photo.jpg"));
    const parsed = await say({ body: form });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(toUserContent(parsed.value)).toEqual([
      { type: "text", text: "what is this" },
      { type: "file", data: png, filename: "photo.jpg", mediaType: "image/jpeg" },
    ]);
  });

  test("caps count, size, and MIME type", async () => {
    const form = new FormData();
    form.append("images", new File([new Uint8Array(SAY.maxBytes + 1)], "big.png", { type: "image/png" }));
    expect(await say({ body: form })).toEqual({ ok: false, error: "image too large (max 3 MiB)" });

    expect(
      await say({
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: [{ data: Buffer.from(png).toString("base64"), mediaType: "application/pdf" }] }),
      }),
    ).toEqual({ ok: false, error: "unsupported image type" });

    expect(
      await say({
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: "nope" }),
      }),
    ).toEqual({ ok: false, error: "images must be an array" });
  });
});
