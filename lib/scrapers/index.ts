import type { RawDocument } from "./utils";
import { scrape as scrapeChinhPhu } from "./chinhphu";
import { scrape as scrapeBHXH } from "./bhxh";
import { scrape as scrapeThuVienPhapLuat } from "./thuvienphapluat";
import { scrape as scrapeLuatVietnam } from "./luatvietnam";
import { scrape as scrapeRSSFeeds } from "./vnexpress-rss";
import { scrape as scrapeGDT } from "./gdt";
import { scrape as scrapeMOF } from "./mof";

export interface ScraperResult {
  source: string;
  documents: RawDocument[];
  error?: string;
}

const SCRAPERS: { name: string; fn: () => Promise<RawDocument[]> }[] = [
  { name: "chinhphu", fn: scrapeChinhPhu },
  { name: "bhxh", fn: scrapeBHXH },
  { name: "thuvienphapluat", fn: scrapeThuVienPhapLuat },
  { name: "luatvietnam", fn: scrapeLuatVietnam },
  { name: "rss-feeds", fn: scrapeRSSFeeds }, // VnExpress + CafeF + Lao Động
  { name: "gdt", fn: scrapeGDT },
  { name: "mof", fn: scrapeMOF },
];

// Caps how long any single scraper can hold up the whole batch. A scraper
// that fetches a list plus many detail pages sequentially under per-domain
// rate limiting can otherwise run far longer than the others.
const SCRAPER_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Scraper "${label}" timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Runs every scraper in parallel via Promise.allSettled so one source failing
 * (site down, layout change, Cloudflare block) never aborts the others. Each
 * scraper is also bounded by SCRAPER_TIMEOUT_MS so a hung request can't stall
 * the whole cron run — a timed-out scraper just reports 0 documents + an
 * error for that source, same as any other failure.
 */
export async function runAll(): Promise<ScraperResult[]> {
  const settled = await Promise.allSettled(
    SCRAPERS.map((s) => withTimeout(s.fn(), SCRAPER_TIMEOUT_MS, s.name))
  );

  return settled.map((result, i) => {
    const { name } = SCRAPERS[i];
    if (result.status === "fulfilled") {
      return { source: name, documents: result.value };
    }
    console.error(`[scraper:${name}] scrape() failed:`, result.reason);
    return {
      source: name,
      documents: [],
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}

export type { RawDocument } from "./utils";
