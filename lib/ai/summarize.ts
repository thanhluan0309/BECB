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
Phân tích văn bản sau và trả về JSON DUY NHẤT (không giải thích, không markdown code block).
Điền đúng theo mẫu bên dưới, thay các chỗ <...> bằng giá trị thật, GIỮ NGUYÊN
các dấu ngoặc/dấu phẩy:

{
  "category": <chọn ĐÚNG 1 từ: BHXH, BHYT, BHTN, LUONG, THUE, LAODONG, OTHER>,
  "highlights": [ {"label": "<tên ngắn>", "value": "<số liệu thật>"} ],
  "summary": "<xem hướng dẫn bên dưới>",
  "effective_date": "YYYY-MM-DD hoặc null",
  "impact": <chọn ĐÚNG 1 từ: HIGH, MEDIUM, LOW>
}

QUY TẮC "highlights":
- Tìm tối đa 5 con số/mốc/điều kiện CỤ THỂ có thật trong văn bản: mức tăng (%),
  số tiền (đồng), số nghị định/thông tư, ngày hiệu lực, đối tượng áp dụng.
- BỎ QUA hoàn toàn các ý không có số liệu cụ thể (ví dụ "cải thiện đời sống",
  "tạo động lực" không đi kèm con số) — thà có 2 mục tốt còn hơn 5 mục có mục
  chung chung.
- Nếu văn bản nói nhiều chính sách khác nhau, chỉ giữ các con số của CHÍNH
  SÁCH quan trọng nhất (tác động nhiều người nhất).
- Chỉ để mảng rỗng [] nếu văn bản thực sự không chứa con số nào.

QUY TẮC "summary":
- Đúng 1 câu tiếng Việt, PHẢI nhắc lại ít nhất 1 con số đã có trong highlights
  ở trên (ví dụ "8%", "2.530.000 đồng", "01/07/2026").
- Không thêm nhận xét cảm tính, không dùng các cụm như "tạo động lực cống
  hiến", "đảm bảo chất lượng cuộc sống", "nhiều chính sách quan trọng".

Ví dụ TỐT: "Tăng lương hưu và trợ cấp BHXH thêm 8% từ 01/07/2026, người có
mức hưởng dưới 3.800.000 đồng/tháng được nâng lên bằng mức này."
Ví dụ XẤU (cấm viết kiểu này): "Điều chỉnh tăng mức tiền lương cơ sở và các
chính sách nhằm tạo động lực cống hiến cho người lao động."

Impact rules:
- HIGH: ảnh hưởng trực tiếp lương/BHXH của người lao động. Ví dụ: thay đổi
  mức lương cơ sở/lương tối thiểu vùng; thay đổi mức giảm trừ gia cảnh thuế
  TNCN; thay đổi biểu thuế lũy tiến TNCN; thay đổi mức đóng BHXH/BHYT/BHTN.
- MEDIUM: thay đổi thủ tục hoặc mức đóng. Ví dụ: thay đổi thủ tục quyết toán
  thuế; bổ sung điều kiện hưởng trợ cấp; hướng dẫn kê khai mới.
- LOW: hướng dẫn kỹ thuật, thay đổi nhỏ. Ví dụ: cập nhật biểu mẫu; hướng dẫn
  kỹ thuật nội bộ.

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
  const jsonSlice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(jsonSlice);
  } catch {
    // Small models frequently leave a trailing comma — cheap, common fix
    // before giving up and paying for a full retry.
    return JSON.parse(jsonSlice.replace(/,\s*([}\]])/g, "$1"));
  }
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

async function requestSummary(rawContent: string): Promise<SummaryResult> {
  const { data } = await openrouter.post<OpenRouterChatResponse>("/chat/completions", {
    model: AI_MODEL,
    max_tokens: 1200,
    messages: [{ role: "user", content: buildPrompt(rawContent) }],
  });

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");

  return coerceResult(extractJSON(text));
}

/**
 * Summarizes and categorizes a raw scraped document via an OpenRouter chat
 * completion call. The free model this uses is non-deterministic and
 * occasionally returns malformed JSON, so a failed attempt is retried once
 * before giving up. Never throws — on repeated failure it logs and returns
 * safe defaults so one bad document can't take down the cron batch.
 */
export async function summarize(rawContent: string): Promise<SummaryResult> {
  if (!rawContent || !rawContent.trim()) return DEFAULT_RESULT;

  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestSummary(rawContent);
    } catch (err) {
      const nextStep = attempt < MAX_ATTEMPTS ? "retrying" : "falling back to defaults";
      console.error(`[ai:summarize] attempt ${attempt}/${MAX_ATTEMPTS} failed, ${nextStep}:`, err);
    }
  }
  return DEFAULT_RESULT;
}
