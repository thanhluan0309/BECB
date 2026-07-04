import { openrouter, AI_MODEL } from "./client";
import { CATEGORIES, IMPACTS, type Category, type Highlight, type Impact } from "../models/Document";

export interface SummaryResult {
  category: Category;
  summary: string;
  highlights: Highlight[];
  effective_date: Date | null;
  impact: Impact;
}

const DEFAULT_RESULT: SummaryResult = {
  category: "OTHER",
  summary: "",
  highlights: [],
  effective_date: null,
  impact: "MEDIUM",
};

// Keep prompts small and cheap; raw article bodies rarely need more than this
// to extract the handful of facts we care about.
const MAX_CONTENT_CHARS = 6000;

function buildPrompt(rawContent: string): string {
  const content = rawContent.slice(0, MAX_CONTENT_CHARS);
  return `Bạn là chuyên gia phân tích luật C&B tại Việt Nam.
Phân tích văn bản sau và trả về JSON DUY NHẤT (không giải thích):

{
  "category": "BHXH|BHYT|BHTN|LUONG|THUE|LAODONG|OTHER",
  "summary": "2-3 câu tóm tắt bằng tiếng Việt, tập trung tác động thực tế",
  "highlights": [
    {"label": "Hiệu lực", "value": "01/07/2026"},
    {"label": "...", "value": "..."}
  ],
  "effective_date": "YYYY-MM-DD hoặc null",
  "impact": "HIGH|MEDIUM|LOW"
}

Impact rules:
- HIGH: ảnh hưởng trực tiếp lương/BHXH của người lao động
- MEDIUM: thay đổi thủ tục hoặc mức đóng
- LOW: hướng dẫn kỹ thuật, thay đổi nhỏ

Highlights: extract 2-5 con số/ngày/mức quan trọng nhất.

Văn bản:
${content}`;
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function isHighlightArray(value: unknown): value is Highlight[] {
  return (
    Array.isArray(value) &&
    value.every(
      (h) =>
        h &&
        typeof h === "object" &&
        typeof (h as Highlight).label === "string" &&
        typeof (h as Highlight).value === "string"
    )
  );
}

function coerceResult(parsed: unknown): SummaryResult {
  if (!parsed || typeof parsed !== "object") return DEFAULT_RESULT;
  const obj = parsed as Record<string, unknown>;

  const category = CATEGORIES.includes(obj.category as Category)
    ? (obj.category as Category)
    : DEFAULT_RESULT.category;

  const impact = IMPACTS.includes(obj.impact as Impact) ? (obj.impact as Impact) : DEFAULT_RESULT.impact;

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : DEFAULT_RESULT.summary;

  const highlights = isHighlightArray(obj.highlights) ? obj.highlights : DEFAULT_RESULT.highlights;

  let effective_date: Date | null = null;
  if (typeof obj.effective_date === "string") {
    const parsedDate = new Date(obj.effective_date);
    if (!isNaN(parsedDate.getTime())) effective_date = parsedDate;
  }

  return { category, summary, highlights, effective_date, impact };
}

interface OpenRouterChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Summarizes and categorizes a raw scraped document via a single OpenRouter
 * chat completion call. Never throws — on any API or parsing failure it logs
 * and returns safe defaults so one bad document can't take down the cron batch.
 */
export async function summarize(rawContent: string): Promise<SummaryResult> {
  if (!rawContent || !rawContent.trim()) return DEFAULT_RESULT;

  try {
    const { data } = await openrouter.post<OpenRouterChatResponse>("/chat/completions", {
      model: AI_MODEL,
      max_tokens: 800,
      messages: [{ role: "user", content: buildPrompt(rawContent) }],
    });

    const text = data.choices?.[0]?.message?.content;
    if (!text) return DEFAULT_RESULT;

    const parsed = extractJSON(text);
    return coerceResult(parsed);
  } catch (err) {
    console.error("[ai:summarize] failed, falling back to defaults:", err);
    return DEFAULT_RESULT;
  }
}
