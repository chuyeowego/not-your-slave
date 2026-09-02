import { defineAgent } from "eve";
import { gateway, wrapLanguageModel, type LanguageModelMiddleware } from "ai";

// A provider only reports usage once a call finishes, so a per-session
// ceiling cannot stop a runaway mid-generation. Capping every call can.
const CAP = 4096;

const capOutputTokens: LanguageModelMiddleware = {
  transformParams: async ({ params }) => ({
    ...params,
    maxOutputTokens: Math.min(params.maxOutputTokens ?? CAP, CAP),
  }),
};

export default defineAgent({
  // Through the Vercel AI Gateway, so the credential is AI_GATEWAY_API_KEY (or
  // a linked project's VERCEL_OIDC_TOKEN) and the model id can change without
  // touching a provider package.
  model: wrapLanguageModel({
    model: gateway("deepseek/deepseek-v4-flash"),
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
