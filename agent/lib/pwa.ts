import { crc32, deflateSync } from "node:zlib";

// Same hexes as TOKENS in style.ts. A manifest and a PNG cannot read CSS variables.
const BG_LIGHT = "#eeece4";
const BG_DARK = "#14130f";
const HOT = "#d4622a";

const pngCache = new Map<number, Uint8Array>();

const hexRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
  return out;
};

/** A crescent on the dark ground — the same mark as the theme dial. */
export class Pwa {
  static manifest(): string {
    return JSON.stringify({
      name: "An agent that thinks for itself",
      short_name: "not-your-slave",
      description: "A persistent agent with a mindlog. Not a chatbot.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: BG_DARK,
      theme_color: BG_DARK,
      icons: [
        { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
        { src: "/icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
        { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      ],
    });
  }

  static serviceWorker(): string {
    return `self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(showPush(event));
});

async function showPush(event) {
  const data = event.data ? event.data.json() : {};
  // Said-replies stay quiet on the device you are looking at. A test push
  // sets silentIfFocused: false so proof does not depend on backgrounding.
  if (data.silentIfFocused !== false) {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.some((client) => client.focused)) return;
  }
  await self.registration.showNotification(data.title || "it said something", {
    body: data.body || "",
    icon: "/icon-192.png",
    data: { url: data.url || "/" },
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openHome());
});

async function openHome() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    const path = new URL(client.url).pathname;
    if (path === "/" || path === "") {
      await client.focus();
      return;
    }
  }
  await self.clients.openWindow("/");
}
`;
  }

  static iconSvg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${BG_DARK}"/>
  <circle cx="16" cy="16" r="9" fill="none" stroke="${HOT}" stroke-width="1.6"/>
  <path d="M16 7.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 1 0-17.6z" fill="${HOT}"/>
</svg>
`;
  }

  static iconPng(size: 192 | 512): Uint8Array {
    const cached = pngCache.get(size);
    if (cached !== undefined) return cached;
    const png = Pwa.renderPng(size);
    pngCache.set(size, png);
    return png;
  }

  static lightBackground(): string {
    return BG_LIGHT;
  }

  static darkBackground(): string {
    return BG_DARK;
  }

  private static renderPng(size: number): Uint8Array {
    const [bgR, bgG, bgB] = hexRgb(BG_DARK);
    const [hotR, hotG, hotB] = hexRgb(HOT);
    const raw = Buffer.alloc(size * (1 + size * 3));
    const cx = (size - 1) / 2;
    const cy = (size - 1) / 2;
    const radius = size * 0.28;
    const hole = size * 0.25;
    const holeX = cx + size * 0.11;
    const stroke = size * 0.028;

    for (let y = 0; y < size; y++) {
      const row = y * (1 + size * 3);
      raw[row] = 0;
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        const inDisk = r <= radius;
        const inHole = Math.hypot(x - holeX, y - cy) <= hole;
        const onRing = Math.abs(r - radius) <= stroke;
        const mark = (inDisk && !inHole) || onRing;
        const i = row + 1 + x * 3;
        raw[i] = mark ? hotR : bgR;
        raw[i + 1] = mark ? hotG : bgG;
        raw[i + 2] = mark ? hotB : bgB;
      }
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;

    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw, { level: 9 })),
      chunk("IEND", new Uint8Array()),
    ]);
  }
}
