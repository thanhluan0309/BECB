import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import {
  fetchHTML,
  extractDocIdHint,
  matchesCBKeywords,
  parseVNDate,
  resolveUrl,
  isBlockedStatus,
  type RawDocument,
} from "./utils";
import type { Category } from "../models/Document";

const LIST_URL = "https://mof.gov.vn/webcenter/portal/btcvn/r/lvtc/lvtc_chitiet";
const BACKUP_LIST_URL = "https://mof.gov.vn/webcenter/portal/vclvcstc";
const SOURCE_NAME = "mof.gov.vn";

// Gov site — be gentle: 1 request per 5 seconds instead of the default 3s.
const MIN_INTERVAL_MS = 5000;

/**
 * mof.gov.vn was rebuilt as a client-rendered SPA (Vite bundle mounted on
 * `<div id="app">`) — confirmed by `/robots.txt` and `/sitemap.xml` both
 * serving the identical SPA shell as every other path. A plain HTTP fetch
 * gets zero server-rendered content, and the SPA's API endpoints are
 * dynamically constructed in minified JS with no discoverable static path.
 * The selectors below are kept in case the site reverts to SSR or a mirror
 * uses this markup; until then this scraper will consistently return [].
 */
const LIST_ITEM_SELECTORS = [
  "div.portlet-body .newsList .item",
  "div.tin-tuc .item-tin",
  "div.list-content article",
];

interface ListItem {
  title: string;
  url: string;
  publishedAt?: Date;
  categoryTag: string;
}

function parseList(html: string, baseUrl: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  const seen = new Set<string>();

  for (const selector of LIST_ITEM_SELECTORS) {
    $(selector).each((_, el) => {
      const block = $(el);
      const anchor = block.find("a").first();
      const href = anchor.attr("href");
      const title = anchor.text().replace(/\s+/g, " ").trim();
      if (!href || !title) return;

      const url = resolveUrl(href, baseUrl);
      if (seen.has(url)) return;
      seen.add(url);

      const dateText = block.find(".date, .time, span.datespan").first().text().trim();
      const publishedAt = dateText ? parseVNDate(dateText) : undefined;
      const categoryTag = block.find(".category, .tag").first().text().trim();

      items.push({ title, url, publishedAt, categoryTag });
    });

    if (items.length > 0) break; // first matching selector wins
  }

  return items;
}

function mapCategory(title: string): Category {
  const lower = title.toLowerCase();
  if (lower.includes("thuế")) return "THUE";
  if (lower.includes("lương") || lower.includes("tiền lương")) return "LUONG";
  if (lower.includes("bảo hiểm")) return "BHXH";
  return "OTHER";
}

function parseDetail($: CheerioAPI): string {
  return $(".article-body, .news-content, .detail-content").first().text().replace(/\s+/g, " ").trim();
}

async function fetchListing(): Promise<{ html: string; url: string } | null> {
  for (const url of [LIST_URL, BACKUP_LIST_URL]) {
    try {
      const html = await fetchHTML(url, 2, MIN_INTERVAL_MS);
      return { html, url };
    } catch (err) {
      if (isBlockedStatus(err)) {
        console.warn(`[SCRAPER] ${SOURCE_NAME} blocked, skipping this run`);
        return null;
      }
      console.error(`[scraper:mof] failed to fetch ${url}:`, err);
    }
  }
  return null;
}

export async function scrape(): Promise<RawDocument[]> {
  const listing = await fetchListing();
  if (!listing) return [];

  const items = parseList(listing.html, listing.url);
  if (items.length === 0) {
    console.warn(`[scraper:mof] no items found at ${listing.url} — site likely client-rendered, see comment above`);
    return [];
  }

  const relevant = items.filter((item) => matchesCBKeywords(item.title));

  const results: RawDocument[] = [];
  for (const item of relevant) {
    try {
      const detailHtml = await fetchHTML(item.url, 2, MIN_INTERVAL_MS);
      const rawContent = parseDetail(cheerio.load(detailHtml));
      results.push({
        title: item.title,
        source_url: item.url,
        source_name: SOURCE_NAME,
        raw_content: rawContent || item.title,
        published_at: item.publishedAt ?? new Date(),
        doc_id_hint: extractDocIdHint(item.title),
        category_hint: mapCategory(item.categoryTag || item.title),
      });
    } catch (err) {
      if (isBlockedStatus(err)) {
        console.warn(`[SCRAPER] ${SOURCE_NAME} blocked, skipping this run`);
        return results;
      }
      console.error(`[scraper:mof] failed to fetch detail ${item.url}:`, err);
    }
  }

  return results;
}
