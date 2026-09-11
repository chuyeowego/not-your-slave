import { defineAgent } from "eve";
import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";

// A provider only reports usage once a call finishes, so a per-session
// ceiling cannot stop a runaway mid-generation. Capping every call can.
const CAP = 4096;

export const promptHasImage = (prompt: unknown): boolean => {
  if (!Array.isArray(prompt)) return false;
  return prompt.some((message) => {
    if (message === null || typeof message !== "object") return false;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) return false;
    return content.some((part) => {
      if (part === null || typeof part !== "object") return false;
      const item = part as { mediaType?: unknown; type?: unknown };
      if (item.type === "image") return true;
      return item.type === "file" && typeof item.mediaType === "string" && item.mediaType.startsWith("image/");
    });
  });
};

export const capOutputTokens: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const gatewayOptions =
      params.providerOptions?.gateway !== null && typeof params.providerOptions?.gateway === "object"
        ? params.providerOptions.gateway
        : {};
    return {
      ...params,
      maxOutputTokens: Math.min(params.maxOutputTokens ?? CAP, CAP),
      ...(promptHasImage(params.prompt)
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
