import { defineAgent } from "eve";
import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";

// A provider only reports usage once a call finishes, so a per-session
// ceiling cannot stop a runaway mid-generation. Capping every call can.
const CAP = 4096;

/** Caption-less home sends use this text part so the provider does not drop the turn. */
const IMAGE_ONLY_TEXT = "(image)";

export const IMAGE_TURN_REMINDER =
  "You can already see this photograph. Read what is in the picture — text, numbers, layout, faces, objects. Do not run opencv, tesseract, imagemagick, python, or bash against /workspace/attachments to inspect it; those copies exist for the runtime, not for you to parse.";

type ContentPart = {
  filename?: unknown;
  mediaType?: unknown;
  text?: unknown;
  type?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isImagePart = (part: unknown): boolean => {
  if (!isRecord(part)) return false;
  const item = part as ContentPart;
  if (item.type === "image") return true;
  return item.type === "file" && typeof item.mediaType === "string" && item.mediaType.startsWith("image/");
};

const contentHasImage = (content: unknown): boolean => Array.isArray(content) && content.some(isImagePart);

export const promptHasImage = (prompt: unknown): boolean => {
  if (!Array.isArray(prompt)) return false;
  return prompt.some((message) => isRecord(message) && contentHasImage(message.content));
};

const dropSandboxImageFilename = (part: unknown): unknown => {
  if (!isImagePart(part) || !isRecord(part)) return part;
  const item = part as ContentPart;
  if (item.type !== "file" || typeof item.filename !== "string" || !item.filename.includes("/")) {
    return part;
  }
  const next = { ...part };
  delete next.filename;
  return next;
};

const withVisionCue = (content: unknown[]): unknown[] => {
  const parts = content.map(dropSandboxImageFilename);
  if (!parts.some(isImagePart)) return parts;
  if (
    parts.some(
      (part) =>
        isRecord(part) &&
        (part as ContentPart).type === "text" &&
        (part as ContentPart).text === IMAGE_TURN_REMINDER,
    )
  ) {
    return parts;
  }
  const onlyStub =
    parts.filter((part) => isRecord(part) && (part as ContentPart).type === "text").length === 1 &&
    parts.some(
      (part) =>
        isRecord(part) &&
        (part as ContentPart).type === "text" &&
        (part as ContentPart).text === IMAGE_ONLY_TEXT,
    );
  if (onlyStub) {
    return parts.map((part) =>
      isRecord(part) && (part as ContentPart).type === "text" && (part as ContentPart).text === IMAGE_ONLY_TEXT
        ? { ...part, text: IMAGE_TURN_REMINDER }
        : part,
    );
  }
  return [{ type: "text", text: IMAGE_TURN_REMINDER }, ...parts];
};

export const promptForVision = (prompt: unknown): unknown => {
  if (!Array.isArray(prompt) || !promptHasImage(prompt)) return prompt;
  return prompt.map((message) => {
    if (!isRecord(message) || message.role !== "user" || !Array.isArray(message.content)) return message;
    if (!contentHasImage(message.content)) return message;
    return { ...message, content: withVisionCue(message.content) };
  });
};

export const capOutputTokens: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const gatewayOptions =
      params.providerOptions?.gateway !== null && typeof params.providerOptions?.gateway === "object"
        ? params.providerOptions.gateway
        : {};
    const hasImage = promptHasImage(params.prompt);
    return {
      ...params,
      prompt: hasImage ? (promptForVision(params.prompt) as typeof params.prompt) : params.prompt,
      maxOutputTokens: Math.min(params.maxOutputTokens ?? CAP, CAP),
      ...(hasImage
        ? {
            providerOptions: {
              ...params.providerOptions,
              gateway: { ...gatewayOptions, has: ["vision"] as const },
            },
          }
        : {}),
    };
  },
};

export default defineAgent({
  // Through the Vercel AI Gateway, so the credential is AI_GATEWAY_API_KEY (or
  // a linked project's VERCEL_OIDC_TOKEN) and the model id can change without
  // touching a provider package.
  model: wrapLanguageModel({
    model: gateway("deepseek/deepseek-v4.1-flash"),
    middleware: capOutputTokens,
  }),
  // The wrapper hides the model id from eve's catalog lookup ("gateway/…"), so
  // the window is stated here. Catalog value for this model, not a guess.
  modelContextWindowTokens: 1_000_000,
  reasoning: "medium",
  // The heartbeat lives in one session forever, so every per-session ceiling
  // has to be off: a 30-day timeout would retire it, and the token budgets
  // would stall it within a day.
  limits: {
    sessionTimeoutMs: false,
    maxInputTokensPerSession: false,
    maxOutputTokensPerSession: false,
  },
});
