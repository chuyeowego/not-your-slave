// The upload caps a person can actually hit: wrong type, too big, too many.
// Driven against the HTTP contract because the page enforces the same limits
// client-side, and a green UI over a permissive server is not a pass.
import { pngFixture, notAnImage } from "../lib/fixtures.mjs";

const dataUrl = (buffer, mediaType) => `data:${mediaType};base64,${buffer.toString("base64")}`;

async function say(baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/say`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

export async function run(ctx) {
  const png = pngFixture();

  const empty = await say(ctx.baseUrl, { message: "   " });
  ctx.check("empty message is rejected", empty.status === 400 && empty.json.error === "message required", empty.json.error);

  const wrongType = await say(ctx.baseUrl, {
    images: [{ data: dataUrl(notAnImage(), "text/plain"), filename: "notes.txt", mediaType: "text/plain" }],
  });
  ctx.check("non-image is rejected", wrongType.status === 400 && wrongType.json.error === "unsupported image type", wrongType.json.error);

  const tooBig = await say(ctx.baseUrl, {
    images: [{ data: dataUrl(Buffer.alloc(3 * 1024 * 1024 + 1), "image/png"), filename: "big.png", mediaType: "image/png" }],
  });
  ctx.check("oversize image is rejected", tooBig.status === 400 && /too large/.test(tooBig.json.error ?? ""), tooBig.json.error);

  const tooMany = await say(ctx.baseUrl, {
    images: Array.from({ length: 5 }, (_, index) => ({
      data: dataUrl(png, "image/png"),
      filename: `shot-${index}.png`,
      mediaType: "image/png",
    })),
  });
  ctx.check("a fifth image is rejected", tooMany.status === 400 && /too many/.test(tooMany.json.error ?? ""), tooMany.json.error);

  const four = await say(ctx.baseUrl, {
    message: "four is the cap",
    images: Array.from({ length: 4 }, (_, index) => ({
      data: dataUrl(png, "image/png"),
      filename: `ok-${index}.png`,
      mediaType: "image/png",
    })),
  });
  ctx.check("four images are accepted", four.status === 200 && four.json.ok === true, JSON.stringify(four.json).slice(0, 120));
}
