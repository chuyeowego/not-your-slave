import type { UserContent } from "ai";

/** eve restores images up to 3 MiB as vision bytes; larger ones become path notes. */
export const SAY = {
  maxImages: 4,
  maxBytes: 3 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/gif"],
} as const;

const ALLOWED_IMAGE_TYPES: ReadonlySet<string> = new Set(SAY.types);

export interface SayImage {
  bytes: Uint8Array;
  filename: string;
  mediaType: (typeof SAY.types)[number];
}

export interface SayTurn {
  images: SayImage[];
  text: string;
}

export type SayResult = { ok: true; value: SayTurn } | { ok: false; error: string };

const ALIASES: Record<string, (typeof SAY.types)[number]> = {
  "image/gif": "image/gif",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/x-png": "image/png",
};

const EXT: Record<string, (typeof SAY.types)[number]> = {
  gif: "image/gif",
  jpe: "image/jpeg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const isMediaType = (value: string): value is (typeof SAY.types)[number] =>
  ALLOWED_IMAGE_TYPES.has(value);

function mediaTypeOf(input: { name?: string; type?: string }): (typeof SAY.types)[number] | null {
  const raw = (input.type ?? "").trim().toLowerCase();
  const aliased = ALIASES[raw];
  if (aliased !== undefined) return aliased;

  const name = input.name ?? "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT[name.slice(dot + 1).toLowerCase()] ?? null;
}

const filenameOf = (name: string | undefined, mediaType: (typeof SAY.types)[number]): string => {
  const trimmed = name?.trim() ?? "";
  if (trimmed.length > 0) return trimmed.slice(0, 180);
  const ext = mediaType === "image/jpeg" ? "jpg" : mediaType.slice("image/".length);
  return `image.${ext}`;
};

const asBytes = (value: Uint8Array): Uint8Array =>
  value.byteOffset === 0 && value.byteLength === value.buffer.byteLength
    ? value
    : value.slice();

function imageFromBytes(
  bytes: Uint8Array,
  filename: string | undefined,
  declaredType: string | undefined,
): { ok: true; value: SayImage } | { ok: false; error: string } {
  const mediaType = mediaTypeOf({ name: filename, type: declaredType });
  if (mediaType === null || !isMediaType(mediaType)) {
    return { ok: false, error: `unsupported image type` };
  }
  if (bytes.byteLength === 0) return { ok: false, error: "empty image" };
  if (bytes.byteLength > SAY.maxBytes) {
    return { ok: false, error: `image too large (max ${SAY.maxBytes / (1024 * 1024)} MiB)` };
  }
  return {
    ok: true,
    value: { bytes: asBytes(bytes), filename: filenameOf(filename, mediaType), mediaType },
  };
}

function collect(images: SayImage[], next: SayImage): { ok: true } | { ok: false; error: string } {
  if (images.length >= SAY.maxImages) {
    return { ok: false, error: `too many images (max ${SAY.maxImages})` };
  }
  images.push(next);
  return { ok: true };
}

function bytesFromData(data: string): Uint8Array | null {
  const trimmed = data.trim();
  if (trimmed.length === 0) return null;
  const comma = trimmed.startsWith("data:") ? trimmed.indexOf(",") : -1;
  const b64 = (comma >= 0 ? trimmed.slice(comma + 1) : trimmed).replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 !== 0) return null;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.byteLength === 0) return null;
  return new Uint8Array(bytes);
}

async function fromForm(request: Request): Promise<SayResult> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, error: "invalid form" };
  }

  const message = form.get("message");
  const text = typeof message === "string" ? message.trim() : "";
  const images: SayImage[] = [];

  for (const [key, value] of form.entries()) {
    if (key !== "images" && key !== "image") continue;
    if (typeof value === "string") return { ok: false, error: "unsupported image type" };
    const bytes = new Uint8Array(await value.arrayBuffer());
    const parsed = imageFromBytes(bytes, value.name, value.type);
    if (!parsed.ok) return parsed;
    const added = collect(images, parsed.value);
    if (!added.ok) return added;
  }

  if (text.length === 0 && images.length === 0) {
    return { ok: false, error: "message required" };
  }
  return { ok: true, value: { text, images } };
}

function fromJson(body: unknown): SayResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid json" };
  }
  const record = body as { images?: unknown; message?: unknown };
  const text = typeof record.message === "string" ? record.message.trim() : "";

  if (record.images === undefined) {
    if (text.length === 0) return { ok: false, error: "message required" };
    return { ok: true, value: { text, images: [] } };
  }
  if (!Array.isArray(record.images)) return { ok: false, error: "images must be an array" };

  const images: SayImage[] = [];
  for (const entry of record.images) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "invalid image payload" };
    }
    const item = entry as { data?: unknown; filename?: unknown; mediaType?: unknown };
    if (typeof item.data !== "string") return { ok: false, error: "invalid image payload" };
    const bytes = bytesFromData(item.data);
    if (bytes === null) return { ok: false, error: "invalid image payload" };
    const parsed = imageFromBytes(
      bytes,
      typeof item.filename === "string" ? item.filename : undefined,
      typeof item.mediaType === "string" ? item.mediaType : undefined,
    );
    if (!parsed.ok) return parsed;
    const added = collect(images, parsed.value);
    if (!added.ok) return added;
  }

  if (text.length === 0 && images.length === 0) {
    return { ok: false, error: "message required" };
  }
  return { ok: true, value: { text, images } };
}

export async function parseSay(request: Request): Promise<SayResult> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) return fromForm(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "invalid json" };
  }
  return fromJson(body);
}

export function toUserContent(turn: SayTurn): string | UserContent {
  if (turn.images.length === 0) return turn.text;
  const parts: Exclude<UserContent, string> = [];
  if (turn.text.length > 0) parts.push({ type: "text", text: turn.text });
  for (const image of turn.images) {
    parts.push({
      type: "file",
      data: image.bytes,
      filename: image.filename,
      mediaType: image.mediaType,
    });
  }
  return parts;
}
