// The browser-side markdown renderer, shared by the app page and the permalink
// page so one renderer covers both. Inlined into each page's script; it defines
// inline(), setMessage() and el().
export const MARKDOWN_JS = String.raw`
// The model writes markdown, so render the little of it that it actually uses.
// Every text node goes in as text, never as markup, so a stray < or a pasted
// tag stays a character.
// [label](url) and bare https:// urls, alongside bold, italics and code. A
// trailing ) . , ; : is punctuation around a bare url, not part of it.
const INLINE =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])|\*\*([^*]+)\*\*|(?<!\*)\*([^*\n]+)\*(?!\*)|\u0060([^\u0060]+)\u0060/g;

function link(href, label) {
  const a = document.createElement("a");
  // Only ever an http(s) url from the pattern above, so no javascript: here.
  a.href = href;
  a.textContent = label;
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  return a;
}

function inline(text, into) {
  INLINE.lastIndex = 0;
  let at = 0;
  let match;
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > at) into.append(text.slice(at, match.index));
    const [, label, href, bare, bold, italic, code] = match;

    if (href !== undefined) into.append(link(href, label));
    else if (bare !== undefined) into.append(link(bare, bare));
    else {
      const tag = bold !== undefined ? "strong" : italic !== undefined ? "em" : "code";
      const node = document.createElement(tag);
      node.textContent = bold ?? italic ?? code;
      into.append(node);
    }
    at = match.index + match[0].length;
  }
  if (at < text.length) into.append(text.slice(at));
}

function setMessage(body, text) {
  body.replaceChildren();
  const lines = text.split("\n");
  let list = null;
  let para = null;
  let fence = null;

  const endBlocks = () => { list = null; para = null; };

  for (const line of lines) {
    if (line.trimStart().startsWith("\u0060\u0060\u0060")) {
      if (fence) { fence = null; } else {
        endBlocks();
        fence = document.createElement("pre");
        body.append(fence);
      }
      continue;
    }
    if (fence) {
      fence.append(fence.childNodes.length ? "\n" + line : line);
      continue;
    }
    if (line.trim() === "") { endBlocks(); continue; }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const wanted = bullet ? "UL" : "OL";
      if (!list || list.tagName !== wanted) {
        list = document.createElement(wanted === "UL" ? "ul" : "ol");
        body.append(list);
        para = null;
      }
      const item = document.createElement("li");
      inline(bullet ? bullet[1] : numbered[2], item);
      list.append(item);
      continue;
    }

    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      endBlocks();
      const h = document.createElement("p");
      h.className = "head";
      inline(heading[1], h);
      body.append(h);
      continue;
    }

    if (!para) {
      para = document.createElement("p");
      body.append(para);
      list = null;
    } else {
      para.append("\n");
    }
    inline(line, para);
  }
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
`;
