// A zero-dependency Chrome DevTools Protocol client. The repo ships no browser
// tooling, and Node 24 has a global WebSocket, so a driver is cheaper than a
// Playwright dependency the app itself never needs.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "google-chrome",
  "chromium",
  "chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((value) => typeof value === "string" && value.length > 0);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Headed Chrome on the VM desktop (push-notify and VERIFY_NYS_HEADED=1). */
export function headedMode(explicit) {
  if (explicit !== undefined) return Boolean(explicit);
  const raw = process.env.VERIFY_NYS_HEADED ?? "";
  return raw === "1" || raw.toLowerCase() === "true";
}

async function seedNotificationAllow(profile, origin) {
  const defaultDir = join(profile, "Default");
  await mkdir(defaultDir, { recursive: true });
  const key = `${origin},*`;
  const prefs = {
    profile: {
      default_content_setting_values: { notifications: 1 },
      content_settings: {
        exceptions: {
          notifications: {
            [key]: { setting: 1 },
          },
        },
      },
    },
  };
  await writeFile(join(defaultDir, "Preferences"), `${JSON.stringify(prefs)}\n`);
}

async function connectSession(url, timeoutMs = 20000) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error(`CDP websocket failed for ${url}`)), { once: true });
  });
  return new Session(ws);
}

async function grantNotificationsOnBrowser(port, origin) {
  try {
    const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, 10000);
    const browser = await connectSession(version.webSocketDebuggerUrl);
    try {
      await browser.send("Browser.grantPermissions", {
        origin,
        permissions: ["notifications"],
      });
    } finally {
      browser.close();
    }
  } catch {
    // Headless page sessions may not expose Browser.*; headed runs still try profile prefs.
  }
}

async function pickPort() {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${url}: ${lastError ?? "no response"}`);
}

class Session {
  #ws;
  #next = 1;
  #pending = new Map();
  #listeners = new Set();

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined) {
        const slot = this.#pending.get(message.id);
        if (slot === undefined) return;
        this.#pending.delete(message.id);
        if (message.error) slot.reject(new Error(`${message.error.message} (${JSON.stringify(message.error)})`));
        else slot.resolve(message.result);
        return;
      }
      for (const listener of this.#listeners) listener(message);
    });
  }

  onEvent(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  send(method, params = {}) {
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.#ws.close();
  }
}

export class Page {
  constructor(session, consoleLog) {
    this.session = session;
    /** Every console message and page error seen since launch. */
    this.consoleLog = consoleLog;
  }

  async goto(url, { waitUntil = "load", timeoutMs = 20000 } = {}) {
    const loaded = this.#once(waitUntil === "load" ? "Page.loadEventFired" : "Page.domContentEventFired", timeoutMs);
    await this.session.send("Page.navigate", { url });
    await loaded;
  }

  /** Returns the JSON value of `expression`, awaiting it when it is a promise. */
  async evaluate(expression) {
    const result = await this.session.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`page evaluate threw: ${text}`);
    }
    return result.result.value;
  }

  /** Polls `expression` until it is truthy. Returns its final value. */
  async waitFor(expression, { timeoutMs = 15000, intervalMs = 150, label = expression } = {}) {
    const waited = await this.waitForOptional(expression, { timeoutMs, intervalMs, label });
    if (waited.ok) return waited.value;
    throw new Error(waited.detail);
  }

  /** Like waitFor but returns { ok, value, detail } instead of throwing. */
  async waitForOptional(expression, { timeoutMs = 15000, intervalMs = 150, label = expression } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      last = await this.evaluate(expression);
      if (last) return { ok: true, value: last };
      await sleep(intervalMs);
    }
    return {
      ok: false,
      value: last,
      detail: `waitFor timed out after ${timeoutMs}ms: ${label} (last value ${JSON.stringify(last)})`,
    };
  }

  /** Attaches real files to an `<input type=file>`, the way a file picker does. */
  async attachFiles(selector, files) {
    const { root } = await this.session.send("DOM.getDocument", { depth: 1 });
    const { nodeId } = await this.session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (nodeId === 0) throw new Error(`no element matched ${selector}`);
    await this.session.send("DOM.setFileInputFiles", { nodeId, files });
  }

  async grantNotifications(origin) {
    await grantNotificationsOnBrowser(this.debugPort, origin);
  }

  async click(selector) {
    const { root } = await this.session.send("DOM.getDocument", { depth: 1 });
    const { nodeId } = await this.session.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (nodeId === 0) throw new Error(`no element matched ${selector}`);
    const box = await this.session.send("DOM.getBoxModel", { nodeId });
    const content = box.model.content;
    const x = (content[0] + content[4]) / 2;
    const y = (content[1] + content[5]) / 2;
    await this.session.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }

  async screenshot(path, { fullPage = false } = {}) {
    const { data } = await this.session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: fullPage,
    });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path, Buffer.from(data, "base64"));
    return path;
  }

  #once(method, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timed out waiting for ${method}`));
      }, timeoutMs);
      const off = this.session.onEvent((message) => {
        if (message.method !== method) return;
        clearTimeout(timer);
        off();
        resolve(message.params);
      });
    });
  }
}

/**
 * Launches Chrome on a throwaway profile, hands `fn` a Page, and always tears
 * the browser and profile down. Pass `{ headed: true }` or set VERIFY_NYS_HEADED=1
 * for the VM desktop (push-notify).
 */
export async function withPage(
  fn,
  { viewport = { width: 1440, height: 900 }, headed, notificationOrigin } = {},
) {
  const useHeaded = headedMode(headed);
  const port = await pickPort();
  const profile = await mkdtemp(join(tmpdir(), "nys-verify-chrome-"));
  if (useHeaded && notificationOrigin) {
    await seedNotificationAllow(profile, notificationOrigin);
  }
  let chrome;
  let lastSpawnError;

  const chromeArgs = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "about:blank",
  ];
  if (useHeaded) {
    chromeArgs.push("--disable-infobars", "--window-position=80,80");
    if (process.env.DISPLAY) {
      // Headed runs need the VM X display.
    } else {
      throw new Error("headed Chrome requires DISPLAY (VM desktop)");
    }
  } else {
    chromeArgs.push("--headless=new", "--disable-gpu");
  }

  for (const binary of CHROME_CANDIDATES) {
    try {
      chrome = spawn(
        binary,
        chromeArgs,
        { stdio: "ignore", env: { ...process.env } },
      );
      await new Promise((resolve, reject) => {
        chrome.once("spawn", resolve);
        chrome.once("error", reject);
      });
      break;
    } catch (error) {
      lastSpawnError = error;
      chrome = undefined;
    }
  }
  if (chrome === undefined) {
    throw new Error(`no Chrome binary found (tried ${CHROME_CANDIDATES.join(", ")}): ${lastSpawnError}`);
  }

  try {
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, 20000);
    const target = targets.find((entry) => entry.type === "page");
    if (target === undefined) throw new Error("Chrome exposed no page target");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("CDP websocket failed")), { once: true });
    });

    const session = new Session(ws);
    const consoleLog = [];
    session.onEvent((message) => {
      if (message.method === "Runtime.consoleAPICalled") {
        const text = (message.params.args ?? [])
          .map((arg) => arg.value ?? arg.description ?? arg.type)
          .join(" ");
        consoleLog.push({ kind: message.params.type, text });
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        consoleLog.push({ kind: "pageerror", text: details.exception?.description ?? details.text });
      }
    });

    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("DOM.enable");

    const page = new Page(session, consoleLog);
    page.debugPort = port;
    try {
      return await fn(page);
    } finally {
      session.close();
    }
  } finally {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill("SIGKILL");
    await Promise.race([exited, sleep(5000)]);
    // Chrome flushes its cache on the way out, so a profile removed the instant
    // after SIGKILL can still be gaining files. Retry rather than fail the run.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rm(profile, { force: true, recursive: true });
        break;
      } catch {
        await sleep(200);
      }
    }
  }
}
