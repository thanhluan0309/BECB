import * as cheerio from "cheerio";
import {
  fetchHTML,
  extractDocIdHint,
  matchesCBKeywords,
  parseVNDate,
  resolveUrl,
  isBlockedStatus,
  type RawDocument,
} from "./utils";

// The URLs in the original brief (wps/portal/home/chinhsachthue, .../vbpq)
// 404 against the live site. This is the real listing endpoint, found by
// crawling the homepage's nav links to the WCM content path for tax news.
const LIST_URL =
  "https://www.gdt.gov.vn/wps/portal/home/news/list?1dmy&current=true&urile=wcm:path:/gdt+content/sa_gdt/sa_news/sa_news_tax";
const SOURCE_NAME = "gdt.gov.vn";

// Gov site — be gentle: 1 request per 5 seconds instead of the default 3s.
const MIN_INTERVAL_MS = 5000;

interface ListItem {
  title: string;
  url: string;
  publishedAt?: Date;
  summary: string;
}

function parseList(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  const seen = new Set<string>();

  $(".list_news li").each((_, el) => {
    const li = $(el);
    const anchor = li.find("span.newtitle a").first();
    const href = anchor.attr("href");
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!href || !title) return;

    const url = resolveUrl(href, LIST_URL);
    if (seen.has(url)) return;
    seen.add(url);

    const dateText = li.find("span.datespan").first().text().trim();
    const publishedAt = dateText ? parseVNDate(dateText) : undefined;
    const summary = li.find("span.des").first().text().replace(/\s+/g, " ").trim();

    items.push({ title, url, publishedAt, summary });
  });

  return items;
}

function parseDetail(html: string): string {
  const $ = cheerio.load(html);
  return $("#contentBody").first().text().replace(/\s+/g, " ").trim();
}

export async function scrape(): Promise<RawDocument[]> {
  let listHtml: string;
  try {
    listHtml = await fetchHTML(LIST_URL, 2, MIN_INTERVAL_MS);
  } catch (err) {
    if (isBlockedStatus(err)) {
      console.warn(`[SCRAPER] ${SOURCE_NAME} blocked, skipping this run`);
      return [];
    }
    console.error(`[scraper:gdt] failed to fetch listing:`, err);
    return [];
  }

  const items = parseList(listHtml);
  if (items.length === 0) {
    console.warn(`[scraper:gdt] no items found at ${LIST_URL} — selectors may need updating`);
    return [];
  }

  const relevant = items.filter((item) => matchesCBKeywords(item.title) || matchesCBKeywords(item.summary));

  const results: RawDocument[] = [];
  for (const item of relevant) {
    try {
      const detailHtml = await fetchHTML(item.url, 2, MIN_INTERVAL_MS);
      const rawContent = parseDetail(detailHtml);
      results.push({
        title: item.title,
        source_url: item.url,
        source_name: SOURCE_NAME,
        raw_content: rawContent || item.summary || item.title,
        published_at: item.publishedAt ?? new Date(),
        doc_id_hint: extractDocIdHint(item.title),
        category_hint: "THUE",
      });
    } catch (err) {
      if (isBlockedStatus(err)) {
        console.warn(`[SCRAPER] ${SOURCE_NAME} blocked, skipping this run`);
        return results;
      }
      console.error(`[scraper:gdt] failed to fetch detail ${item.url}:`, err);
    }
  }

  return results;
}
