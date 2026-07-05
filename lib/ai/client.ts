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
    timeout: 20000, // fail fast on a degraded free-tier provider instead of stalling the cron run
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cb-law-radar.local",
      "X-Title": "C&B Law Radar",
    },
  });

global._openrouterClient = openrouter;

// Free tier on OpenRouter. The smallest free model (liquid/lfm-2.5-1.2b) was
// too weak for this task in practice: it echoed the category enum literally
// instead of picking a value and wrote generic, numberless summaries even
// with an explicit anti-vagueness prompt. This 9B model consistently
// produces valid JSON, correct categories, and summaries/highlights that
// cite real figures from the source text — still $0 cost.
export const AI_MODEL = "nvidia/nemotron-nano-9b-v2:free";
