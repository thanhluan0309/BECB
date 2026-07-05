import axios from "axios";
import type { Category } from "../models/Document";

export interface RawDocument {
  title: string;
  source_url: string;
  source_name: string;
  raw_content: string;
  published_at: Date;
  doc_id_hint?: string;
  /** Forces the document category, bypassing AI classification (e.g. BHXH source). */
  category_hint?: Category;
}

export const CB_KEYWORDS = [
  // Thuế TNCN
  "thuế TNCN",
  "thuế thu nhập cá nhân",
  "giảm trừ gia cảnh",
  "biểu thuế lũy tiến",
  "khấu trừ thuế",
  "quyết toán thuế",
  "TNCN",
  "thu nhập chịu thuế",
  "mức giảm trừ",

  // Lương
  "lương cơ sở",
  "lương tối thiểu",
  "lương tối thiểu vùng",
  "mức lương cơ bản",
  "hệ số lương",
  "phụ cấp lương",
  "Nghị định lương",
  "tăng lương",
  "điều chỉnh lương",

  // Existing (BHXH/BHYT/BHTN/lao động)
  "BHXH",
  "bảo hiểm xã hội",
  "BHYT",
  "bảo hiểm y tế",
  "BHTN",
  "bảo hiểm thất nghiệp",
  "bảo hiểm",
  "trợ cấp",
  "hưu trí",
  "thai sản",
  "nghỉ phép",
  "lao động",
  "hợp đồng lao động",
  "Nghị định",
  "Thông tư",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MIN_INTERVAL_MS = 3000;
// Kept tight so a hanging site fails fast instead of compounding across
// retries (worst case with 2 retries + exponential backoff: ~33s per URL).
const AXIOS_TIMEOUT_MS = 10_000;
const lastRequestAtByDomain = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function throttle(url: string, minIntervalMs: number): Promise<void> {
  const domain = getDomain(url);
  const last = lastRequestAtByDomain.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
  lastRequestAtByDomain.set(domain, Date.now());
}

async function fetchHTMLAttempt(
  url: string,
  minIntervalMs: number,
  attempt: number,
  maxRetries: number
): Promise<string> {
  await throttle(url, minIntervalMs);
  try {
    const { data } = await axios.get<string>(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      },
      timeout: AXIOS_TIMEOUT_MS,
      responseType: "text",
    });
    return data;
  } catch (err) {
    if (attempt < maxRetries) {
      await sleep(1000 * 2 ** attempt); // exponential backoff: 1s, 2s, 4s...
      return fetchHTMLAttempt(url, minIntervalMs, attempt + 1, maxRetries);
    }
    throw err;
  }
}

/**
 * Fetch HTML with a browser-like User-Agent, 10s timeout, per-domain rate
 * limiting (default 1 req / 3s, override via `minIntervalMs` for stricter
 * gov sites), and up to `retries` retries with exponential backoff.
 */
export function fetchHTML(url: string, retries = 2, minIntervalMs = MIN_INTERVAL_MS): Promise<string> {
  return fetchHTMLAttempt(url, minIntervalMs, 0, retries);
}

export function matchesCBKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return CB_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Extract a normalized doc_id hint from a title, e.g. "ND-158-2025".
 * Vietnamese legal titles use two common orderings, both handled here:
 *   "NĐ 158/2025"        (prefix first)
 *   "158/2025/NĐ-CP"     (number/year/prefix, most common in practice)
 * Returns undefined if no document number pattern is found.
 */
export function extractDocIdHint(title: string): string | undefined {
  const prefixFirst = title.match(/(NĐ|QĐ|TT|Luật)[-\s]?(\d+)\/(\d+)/i);
  if (prefixFirst) {
    const prefix = stripDiacritics(prefixFirst[1]).toUpperCase();
    return `${prefix}-${prefixFirst[2]}-${prefixFirst[3]}`;
  }

  const numberFirst = title.match(/(\d+)\/(\d{4})\/(NĐ|QĐ|TT)/i);
  if (numberFirst) {
    const prefix = stripDiacritics(numberFirst[3]).toUpperCase();
    return `${prefix}-${numberFirst[1]}-${numberFirst[2]}`;
  }

  const numberPrefixOnly = title.match(/(\d+)\/(NĐ|QĐ|TT)-([A-ZĐ]+)/i);
  if (numberPrefixOnly) {
    const prefix = stripDiacritics(numberPrefixOnly[2]).toUpperCase();
    const agency = stripDiacritics(numberPrefixOnly[3]).toUpperCase();
    return `${prefix}-${numberPrefixOnly[1]}-${agency}`;
  }

  // "Công văn" titles lead with the word instead of trailing the number
  // (e.g. "Công văn số 1234/TCT-CS"), unlike NĐ/QĐ/TT.
  const congVan = title.match(/Công văn\s*(?:số)?\s*(\d+)\/([A-ZĐ][A-ZĐ0-9-]*)/i);
  if (congVan) {
    const agency = stripDiacritics(congVan[2]).toUpperCase();
    return `CV-${congVan[1]}-${agency}`;
  }

  return undefined;
}

function stripDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d");
}

/**
 * Parse "DD/MM/YYYY" or "DD/MM/YYYY HH:mm[:ss] [AM|PM]" (Vietnamese date format).
 */
export function parseVNDate(text: string): Date | undefined {
  const cleaned = text.trim();
  const match = cleaned.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i
  );
  if (!match) return undefined;
  const [, dd, mm, yyyy, hh, min, ss, ampm] = match;
  let hour = hh ? parseInt(hh, 10) : 0;
  if (ampm) {
    const isPM = ampm.toUpperCase() === "PM";
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }
  const date = new Date(
    parseInt(yyyy, 10),
    parseInt(mm, 10) - 1,
    parseInt(dd, 10),
    hour,
    min ? parseInt(min, 10) : 0,
    ss ? parseInt(ss, 10) : 0
  );
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse "MM/DD/YYYY HH:mm:ss AM|PM" (used by chinhphu.vn's time-ago title attr).
 */
export function parseUSDateTime(text: string): Date | undefined {
  const cleaned = text.trim();
  const match = cleaned.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i
  );
  if (!match) return undefined;
  const [, mm, dd, yyyy, hh, min, ss, ampm] = match;
  let hour = parseInt(hh, 10);
  if (ampm) {
    const isPM = ampm.toUpperCase() === "PM";
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
  }
  const date = new Date(
    parseInt(yyyy, 10),
    parseInt(mm, 10) - 1,
    parseInt(dd, 10),
    hour,
    parseInt(min, 10),
    parseInt(ss, 10)
  );
  return isNaN(date.getTime()) ? undefined : date;
}

export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** True if a fetchHTML() rejection was a 403/429 anti-bot block rather than a network/parse issue. */
export function isBlockedStatus(err: unknown): boolean {
  return axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 429);
}
