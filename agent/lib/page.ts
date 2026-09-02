import { MARKDOWN_JS } from "./markdown.ts";
import { FONTS, TOKENS } from "./style.ts";

export const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>An agent that thinks for itself</title>
${FONTS}
<script>
  try {
    const saved = localStorage.getItem("nys.theme");
    if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);
  } catch {}
</script>
<style>
${TOKENS}

  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: "Newsreader", Georgia, serif;
    font-size: 17px;
    line-height: 1.5;
    overflow: hidden;
  }
  .frame {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5px var(--mindlog, 32rem);
    height: 100dvh;
  }
  .pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
  .grip {
    background: var(--rule); cursor: col-resize; border: 0; padding: 0;
    touch-action: none; position: relative;
  }
  .grip::after {
    content: ""; position: absolute; inset: 0 -4px; /* a bigger target than the line */
  }
  .grip:hover, .grip:focus-visible { background: var(--hot); outline: none; }

  header {
    display: flex; align-items: baseline; gap: .6rem;
    padding: .9rem 1.2rem; border-bottom: 1px solid var(--rule);
    font-family: var(--mono);
    font-size: .68rem; letter-spacing: .14em; text-transform: uppercase;
    color: var(--dim); flex: 0 0 auto;
    /* Room for the theme toggle, which floats over the top-right corner of
       whichever pane happens to be there. */
    padding-right: 3.4rem;
  }
  header b { color: var(--ink); font-weight: 700; }
  header .spacer { flex: 1; }
  button {
    font: inherit; font-family: var(--mono); font-size: .62rem;
    letter-spacing: .12em; text-transform: uppercase;
    background: transparent; color: var(--dim);
    border: 1px solid var(--rule); border-radius: 2px;
    padding: .3rem .6rem; cursor: pointer;
  }
  button:hover { color: var(--hot); border-color: var(--hot); }
  button:disabled { opacity: .4; cursor: default; }
  #mindlog-open, #mindlog-close { display: none; }
  /* Same round dial as the theme gallery: a filled half-circle, mirrored so
     the shading follows the theme you are in. */
  .theme-toggle {
    position: fixed; top: .62rem; right: .8rem; z-index: 50;
    width: 34px; height: 34px; display: grid; place-items: center;
    border: 1px solid var(--rule); border-radius: 999px;
    background: var(--panel); color: var(--dim);
    font: 15px/1 var(--mono); letter-spacing: 0; padding: 0; cursor: pointer;
  }
  .theme-toggle:hover, .theme-toggle:focus-visible { color: var(--ink); border-color: var(--dim); }
  .theme-toggle::before { content: "\25D0"; }
  :root[data-theme="dark"] .theme-toggle::before { content: "\25D1"; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .theme-toggle::before { content: "\25D1"; }
  }
  .scroll { flex: 1 1 auto; overflow-y: auto; padding: 1.2rem; }
  .msg { margin: 0 0 1.4rem; max-width: 60ch; }
  .msg .who {
    font-family: var(--mono); font-size: .62rem;
    letter-spacing: .14em; text-transform: uppercase; color: var(--dim);
    display: block; margin-bottom: .25rem;
  }
  .msg.me .who { color: var(--hot); }
  .msg.it .who { color: var(--cool); }
  .woke {
    display: flex; align-items: center; gap: .7rem; margin: 0 0 1.4rem;
    font-family: var(--mono); font-size: .6rem; letter-spacing: .18em;
    text-transform: uppercase; color: var(--faint);
  }
  .woke::before, .woke::after { content: ""; flex: 1; border-top: 1px dotted var(--rule); }
  #earlier { display: block; margin: 0 auto 1.6rem; }
  .msg .body > * { margin: 0 0 .6rem; }
  .msg .body > *:last-child { margin-bottom: 0; }
  .msg p { white-space: pre-wrap; }
  .msg.me .body { color: var(--dim); }
  .msg.it .body { color: var(--ink); }
  .msg p.head { font-weight: 600; letter-spacing: .01em; }
  .msg strong { font-weight: 600; }
  .msg em { font-style: italic; }
  .msg ul, .msg ol { padding-left: 1.4rem; }
  .msg li { margin: 0 0 .3rem; }
  .msg a { color: var(--hot); text-underline-offset: 2px; }
  .msg a:hover { text-decoration-thickness: 2px; }
  .msg code {
    font-family: var(--mono); font-size: .82em;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 2px;
    padding: .05em .3em;
  }
  .msg pre {
    font-family: var(--mono); font-size: .78rem;
    background: var(--panel); border: 1px solid var(--rule); border-radius: 2px;
    padding: .7rem .8rem; overflow-x: auto; white-space: pre;
  }
  form {
    display: flex; gap: .6rem; align-items: flex-end;
    padding: 1rem 1.2rem; border-top: 1px solid var(--rule); flex: 0 0 auto;
  }
  form button { flex: 0 0 auto; height: 2.6rem; }
  textarea {
    flex: 1; resize: none; font: inherit; color: var(--ink);
    background: var(--panel); border: 1px solid var(--rule); border-radius: 2px;
    padding: .55rem .7rem; min-height: 2.6rem; max-height: 40vh;
    overflow-y: auto;
  }
  textarea:focus { outline: none; border-color: var(--hot); }
  textarea::placeholder { color: var(--faint); font-style: italic; opacity: 1; }
  .entry {
    font-family: var(--mono);
    font-size: .82rem; line-height: 1.55;
    padding: .5rem 0; border-bottom: 1px dotted var(--faint);
    display: grid; grid-template-columns: 4.6rem 1fr; gap: .55rem;
    align-items: start;
  }
  /* Time over kind in one column: the row then has a single narrow gutter and
     the text gets the rest of the width. The time is also the permalink. */
  .entry .when { display: grid; gap: .1rem; }
  .entry .at { color: var(--faint); text-decoration: none; }
  .entry .at:hover, .entry .at:focus-visible { color: var(--hot); text-decoration: underline; }
  .entry .kind { letter-spacing: .1em; text-transform: uppercase; font-size: .7rem; }
  .entry .text { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--dim); }
  .entry[data-kind="heard"] .kind { color: var(--hot); }
  .entry[data-kind="said"] .kind { color: var(--cool); }
  .entry[data-kind="thought"] .kind { color: var(--think); }
  .entry[data-kind="thought"] .text { color: var(--ink); font-style: italic; }
  .entry[data-kind="note"] .kind, .entry[data-kind="note"] .text { color: var(--note); }
  .entry[data-kind="did"] .kind { color: var(--faint); }
  .entry[data-kind="woke"] .kind, .entry[data-kind="woke"] .text { color: var(--think); }
  .empty { color: var(--faint); font-style: italic; }
  /* On a phone the chat is the whole screen and the composer stays on it: the
     mindlog slides in over the top instead of living below the fold, where the
     old stacked layout put it a full viewport away. */
  @media (max-width: 800px) {
    .frame { grid-template-columns: 1fr; height: 100dvh; }
    .grip { display: none; }
    #mindlog-open, #mindlog-close { display: inline-block; }

    .pane.mindlog {
      position: fixed; inset: 0 0 0 auto; z-index: 20;
      width: min(92vw, 30rem);
      background: var(--bg); border-left: 1px solid var(--rule);
      transform: translateX(100%); transition: transform .18s ease-out;
      box-shadow: -12px 0 32px rgb(0 0 0 / .35);
    }
    body[data-mindlog="open"] .pane.mindlog { transform: none; }
  }
  @media (max-width: 800px) and (prefers-reduced-motion: reduce) {
    .pane.mindlog { transition: none; }
  }
</style>
</head>
<body>
<div class="frame">
  <section class="pane">
    <header><b>an agent that thinks for itself</b><span class="spacer"></span><button id="mindlog-open" type="button">mindlog</button><span id="status">idle</span></header>
    <div class="scroll" id="chat"><p class="empty">Say something. It may or may not care.</p></div>
    <form id="composer">
      <textarea id="input" rows="1"></textarea>
      <button type="submit" title="Send (Cmd/Ctrl+Enter)">Send</button>
    </form>
  </section>
  <button id="theme" class="theme-toggle" type="button" title="Switch theme" aria-label="Switch theme"></button>
  <div class="grip" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize the mindlog"></div>
  <section class="pane mindlog">
    <header><b>mindlog</b><span class="spacer"></span><button id="think" type="button">Wake it</button><button id="mindlog-close" type="button" aria-label="Close the mindlog">close</button></header>
    <div class="scroll" id="mindlog"><p class="empty">Nothing yet.</p></div>
  </section>
</div>
<script>
const chat = document.getElementById("chat");
const mindlogEl = document.getElementById("mindlog");
const statusEl = document.getElementById("status");
const input = document.getElementById("input");
let sessionId = null;

// Replaced when the page is served: the first line of the heartbeat prompt.
const WAKE_PREFIX = __WAKE_PREFIX__;
const isWake = (text) => typeof text === "string" && text.startsWith(WAKE_PREFIX);

function wokeMarker(prepend) {
  chat.querySelector(".empty")?.remove();
  const mark = document.createElement("div");
  mark.className = "woke";
  mark.append("woke");
  place(mark, prepend);
}
let live = null;

${MARKDOWN_JS}

function place(node, prepend) {
  if (prepend) {
    const anchor = document.getElementById("earlier");
    chat.insertBefore(node, anchor ? anchor.nextSibling : chat.firstChild);
  } else {
    chat.append(node);
    chat.scrollTop = chat.scrollHeight;
  }
}

function bubble(cls, who, text, prepend) {
  chat.querySelector(".empty")?.remove();
  const wrap = el("div", "msg " + cls);
  const body = el("div", "body");
  setMessage(body, text);
  wrap.append(el("span", "who", who), body);
  place(wrap, prepend);
  return body;
}

let mindlogSeen = "";
let mindlogTag = "";

async function refreshMindlog() {
  const res = await fetch("/api/mindlog?limit=120", {
    headers: mindlogTag ? { "if-none-match": mindlogTag } : {},
  });
  if (res.status === 304) return; // nothing appended since the last poll
  mindlogTag = res.headers.get("etag") || "";
  const { entries } = await res.json();
  if (entries.length === 0) return;

  // The log is append-only, so length plus the newest timestamp is enough to
  // know nothing changed. Polls that see nothing new leave the DOM untouched.
  const seen = entries.length + ":" + entries[entries.length - 1].at;
  if (seen === mindlogSeen) return;
  mindlogSeen = seen;

  const atBottom = mindlogEl.scrollHeight - mindlogEl.scrollTop - mindlogEl.clientHeight < 60;
  mindlogEl.replaceChildren(...entries.map((e) => {
    const row = el("div", "entry");
    row.dataset.kind = e.kind;
    // The time is the permalink, so every row is bookmarkable without a
    // hover-only control. Entries written before ids existed fall back to
    // their timestamp as the key.
    const at = document.createElement("a");
    at.className = "at";
    at.href = "/entry/" + encodeURIComponent(e.id || e.at);
    at.title = "open this entry on its own page";
    at.textContent = new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

    const when = el("div", "when");
    when.append(at, el("span", "kind", e.kind));
    row.append(when, el("span", "text", e.text));
    return row;
  }));
  if (atBottom) mindlogEl.scrollTop = mindlogEl.scrollHeight;
}

async function readNdjson(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.trim() === "") continue;
      try { onEvent(JSON.parse(line)); } catch {}
    }
  }
}

// One long-lived reader per session. A new session starts at 0; an existing one
// resumes at the tail so a reload does not replay old turns into the chat.
async function follow(id, startIndex) {
  while (id === sessionId) {
    try {
      const res = await fetch("/eve/v1/session/" + id + "/stream?startIndex=" + startIndex);
      if (!res.ok) return;
      await readNdjson(res, handle);
    } catch {}
    startIndex = -1;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

let pending = null;

function showAssistant(text) {
  if (!text) return; // nothing to show yet: no empty bubble with a bare label
  if (!live) live = bubble("it", "it", "");
  pending = text;
  requestAnimationFrame(() => {
    if (pending === null) return;
    setMessage(live, pending);
    pending = null;
    chat.scrollTop = chat.scrollHeight;
  });
}

// The final text must land even if the frame callback has not run yet.
function flushAssistant(text) {
  pending = null;
  if (!text) return;
  if (!live) live = bubble("it", "it", "");
  setMessage(live, text);
  chat.scrollTop = chat.scrollHeight;
}

function handle(event) {
  const data = event.data || {};
  switch (event.type) {
    case "message.received":
      if (isWake(data.message)) wokeMarker();
      break;
    case "turn.started":
      statusEl.textContent = "thinking";
      break;
    case "message.appended":
      showAssistant(data.messageSoFar || "");
      break;
    case "message.completed":
      if (data.message) flushAssistant(data.message);
      live = null;
      void refreshMindlog();
      break;
    case "turn.failed":
      bubble("it", "it", "[" + (data.message || "turn failed") + "]");
      live = null;
      statusEl.textContent = "error";
      break;
    case "turn.completed":
    case "session.waiting":
      statusEl.textContent = "idle";
      void refreshMindlog();
      break;
  }
}

// Every message goes to the agent's one session, whichever that currently is.
// The server creates it when the address has none, so the page never has to
// reconcile an id it remembered with the one that exists.
async function send(text) {
  bubble("me", "you", text);
  statusEl.textContent = "thinking";

  const res = await fetch("/api/say", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: text }),
  });
  const started = await res.json();

  if (!started.ok) {
    bubble("it", "it", "[" + (started.error || res.status) + "]");
    statusEl.textContent = "error";
    return;
  }

  if (started.sessionId !== sessionId) {
    sessionId = started.sessionId;
    void follow(sessionId, -1);
  }
}

// Typing anywhere on the page goes to the composer, so there is nothing to
// click first. Modifier combos, real fields, and button keys are left alone.
input.focus();

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const active = document.activeElement;
  if (active === input) return;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
  if (active instanceof HTMLElement && active.isContentEditable) return;
  if (active instanceof HTMLButtonElement && (e.key === " " || e.key === "Enter")) return;

  if (e.key.length === 1 || e.key === "Backspace") input.focus();
});

document.getElementById("composer").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  fitInput();
  void send(text);
});

// The box grows with what is in it, up to the max-height the stylesheet sets,
// so a long message stays readable while it is being written.
function fitInput() {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
}

input.addEventListener("input", fitInput);

// Enter is a newline on every device - on a phone there is no shift to hold,
// and half-written thoughts should not send themselves. Cmd/Ctrl+Enter sends,
// as does the Send button.
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    document.getElementById("composer").requestSubmit();
  }
});

const frame = document.querySelector(".frame");
const grip = document.querySelector(".grip");
const MIN = 280;

function setMindlog(px) {
  const max = Math.max(MIN, window.innerWidth - 360);
  const width = Math.min(Math.max(px, MIN), max);
  frame.style.setProperty("--mindlog", width + "px");
  try { localStorage.setItem("nys.mindlog", String(width)); } catch {}
}

grip.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const move = (ev) => setMindlog(window.innerWidth - ev.clientX);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    document.body.style.userSelect = "";
  };
  document.body.style.userSelect = "none";
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
});

grip.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 64 : 16;
  if (e.key === "ArrowLeft") setMindlog(mindlogEl.parentElement.getBoundingClientRect().width + step);
  else if (e.key === "ArrowRight") setMindlog(mindlogEl.parentElement.getBoundingClientRect().width - step);
  else return;
  e.preventDefault();
});

try {
  const saved = Number(localStorage.getItem("nys.mindlog"));
  if (Number.isFinite(saved) && saved > 0) setMindlog(saved);
} catch {}

const themeButton = document.getElementById("theme");

function currentTheme() {
  const stamped = document.documentElement.getAttribute("data-theme");
  if (stamped) return stamped;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

themeButton.addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("nys.theme", next); } catch {}
});

// Distinct from setMindlog(px), which sets the pane's width on desktop.
const showMindlog = (open) => {
  document.body.dataset.mindlog = open ? "open" : "closed";
  if (open) void refreshMindlog();
};
document.getElementById("mindlog-open").addEventListener("click", () => showMindlog(true));
document.getElementById("mindlog-close").addEventListener("click", () => showMindlog(false));
// Hidden until asked for, on a phone.
showMindlog(false);

document.getElementById("think").addEventListener("click", async (e) => {
  const button = e.currentTarget;
  button.disabled = true;
  button.textContent = "waking";
  try {
    const res = await fetch("/api/think", { method: "POST" });
    if (!res.ok) button.textContent = "failed";
  } finally {
    setTimeout(() => { button.disabled = false; button.textContent = "Wake it"; }, 4000);
  }
});

// History comes from the mindlog rather than the event stream. The stream is
// mostly per-character deltas: the newest 600 events covered six messages and
// several MB, and replaying the whole session took tens of seconds before the
// first bubble. The mindlog already holds exactly the conversation - heard,
// said, woke - so a page of it is a few KB. The stream is still what renders a
// reply as it arrives.
const PAGE_ENTRIES = 240;
const SPOKEN = new Set(["heard", "said", "woke"]);
let oldestShown = null; // timestamp of the oldest entry rendered, for paging back

function paintEntry(entry, prepend) {
  if (entry.kind === "woke") wokeMarker(prepend);
  else if (entry.kind === "heard") bubble("me", "you", entry.text, prepend);
  else bubble("it", "it", entry.text, prepend);
}

async function conversationPage(before) {
  const url =
    "/api/mindlog?limit=" + PAGE_ENTRIES +
    (before === undefined ? "" : "&before=" + encodeURIComponent(before));
  const res = await fetch(url);
  if (!res.ok) return [];
  const { entries } = await res.json();
  return entries.filter((entry) => SPOKEN.has(entry.kind));
}

function earlierControl(more) {
  document.getElementById("earlier")?.remove();
  if (!more) return;

  const button = el("button", "", "load earlier");
  button.id = "earlier";
  button.type = "button";
  button.addEventListener("click", async () => {
    button.textContent = "loading…";
    button.disabled = true;
    const older = await conversationPage(oldestShown);
    for (const entry of [...older].reverse()) paintEntry(entry, true);
    if (older.length > 0) oldestShown = older[0].at;
    earlierControl(older.length > 0);
  });
  chat.insertBefore(button, chat.firstChild);
}

async function restore(id) {
  statusEl.textContent = "loading";
  try {
    const spoken = await conversationPage(undefined);
    for (const entry of spoken) paintEntry(entry, false);
    oldestShown = spoken.length > 0 ? spoken[0].at : null;
    earlierControl(spoken.length > 0);
  } catch {}
  statusEl.textContent = "idle";
  void follow(id, -1);
}

// The agent may already be mid-thought from a heartbeat before anyone opens the
// page, and it may not have a session at all yet. Keep asking until there is one
// to attach to: otherwise a page opened first would miss everything the agent
// said until someone typed, and only the mindlog would show it.
async function ensureSession() {
  if (sessionId !== null) return;
  try {
    const { sessionId: existing } = await (await fetch("/api/session")).json();
    if (existing !== null && sessionId === null) {
      sessionId = existing;
      await restore(existing);
    }
  } catch {}
}

// A different one each visit, so the empty box has some life in it.
input.placeholder = [
  "it is thinking anyway",
  "it has been up for hours",
  "say something, or don't",
  "you are the interruption",
][Math.floor(Math.random() * 4)];

localStorage.removeItem("nys.session"); // the server owns this now
void ensureSession();

void refreshMindlog();
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  void refreshMindlog();
  void ensureSession();
}, 3000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  void refreshMindlog();
  void ensureSession();
});
</script>
</body>
</html>`;
