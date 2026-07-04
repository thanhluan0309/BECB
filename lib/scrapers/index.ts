import type { RawDocument } from "./utils";
import { scrape as scrapeChinhPhu } from "./chinhphu";
import { scrape as scrapeBHXH } from "./bhxh";
import { scrape as scrapeThuVienPhapLuat } from "./thuvienphapluat";
import { scrape as scrapeLuatVietnam } from "./luatvietnam";
import { scrape as scrapeVnExpress } from "./vnexpress-rss";

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
  { name: "vnexpress-rss", fn: scrapeVnExpress },
];

/**
 * Runs every scraper in parallel via Promise.allSettled so one source failing
 * (site down, layout change, Cloudflare block) never aborts the others.
 */
export async function runAll(): Promise<ScraperResult[]> {
  const settled = await Promise.allSettled(SCRAPERS.map((s) => s.fn()));

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
