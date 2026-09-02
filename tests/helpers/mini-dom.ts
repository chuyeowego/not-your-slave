import vm from "node:vm";

/** Enough of the DOM for MARKDOWN_JS: createElement, append, text, and links. */
export class MiniNode {
  readonly childNodes: Array<MiniNode | string> = [];
  className = "";
  href = "";
  target = "";
  rel = "";

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return this.childNodes.map((child) => (typeof child === "string" ? child : child.textContent)).join("");
  }

  set textContent(value: string | undefined) {
    this.childNodes.length = 0;
    if (value !== undefined && value !== "") this.childNodes.push(value);
  }

  append(...items: Array<MiniNode | string>): void {
    this.childNodes.push(...items);
  }

  replaceChildren(...items: Array<MiniNode | string>): void {
    this.childNodes.length = 0;
    this.append(...items);
  }
}

export class MiniDocument {
  createElement(tag: string): MiniNode {
    return new MiniNode(tag.toUpperCase());
  }

  static html(node: MiniNode | string): string {
    if (typeof node === "string") return node;
    const attrs: string[] = [];
    if (node.className) attrs.push(`class="${node.className}"`);
    if (node.href) attrs.push(`href="${node.href}"`);
    if (node.target) attrs.push(`target="${node.target}"`);
    if (node.rel) attrs.push(`rel="${node.rel}"`);
    const open = attrs.length === 0 ? node.tagName.toLowerCase() : `${node.tagName.toLowerCase()} ${attrs.join(" ")}`;
    return `<${open}>${node.childNodes.map((child) => MiniDocument.html(child)).join("")}</${node.tagName.toLowerCase()}>`;
  }
}

export class Markdown {
  static render(source: string, text: string): MiniNode {
    const document = new MiniDocument();
    const context = vm.createContext({ document });
    vm.runInContext(source, context);
    const body = document.createElement("div");
    const setMessage = (context as { setMessage: (into: MiniNode, value: string) => void }).setMessage;
    setMessage(body, text);
    return body;
  }
}
