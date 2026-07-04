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
  "BHXH",
  "bảo hiểm",
  "lương tối thiểu",
  "thuế TNCN",
  "lao động",
  "nghỉ phép",
  "trợ cấp",
  "hưu trí",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MIN_INTERVAL_MS = 3000;
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

async function throttle(url: string): Promise<void> {
  const domain = getDomain(url);
  const last = lastRequestAtByDomain.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < MIN_INTERVAL_MS) {
    await sleep(MIN_INTERVAL_MS - elapsed);
  }
  lastRequestAtByDomain.set(domain, Date.now());
}

/**
 * Fetch HTML with a browser-like User-Agent, 15s timeout, rate limiting
 * (max 1 req / 3s per domain), and up to `retries` retries on failure.
 */
export async function fetchHTML(url: string, retries = 2): Promise<string> {
  await throttle(url);
  try {
    const { data } = await axios.get<string>(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 15000,
      responseType: "text",
    });
    return data;
  } catch (err) {
    if (retries > 0) {
      await sleep(1000);
      return fetchHTML(url, retries - 1);
    }
    throw err;
  }
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
