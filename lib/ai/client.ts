import axios, { type AxiosInstance } from "axios";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error("Missing OPENROUTER_API_KEY environment variable");
}

declare global {
  // eslint-disable-next-line no-var
  var _openrouterClient: AxiosInstance | undefined;
}

export const openrouter: AxiosInstance =
  global._openrouterClient ??
  axios.create({
    baseURL: "https://openrouter.ai/api/v1",
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cb-law-radar.local",
      "X-Title": "C&B Law Radar",
    },
  });

global._openrouterClient = openrouter;

// Lightest free instruct model on OpenRouter (1.2B params, non-"thinking"
// variant) — cheap and fast enough for structured JSON extraction.
export const AI_MODEL = "liquid/lfm-2.5-1.2b-instruct:free";
