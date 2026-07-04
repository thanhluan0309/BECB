import * as cheerio from "cheerio";
import {
  fetchHTML,
  extractDocIdHint,
  matchesCBKeywords,
  parseUSDateTime,
  resolveUrl,
  type RawDocument,
} from "./utils";

const LIST_URL = "https://xaydungchinhsach.chinhphu.vn/";
const SOURCE_NAME = "Chính phủ - Xây dựng chính sách";

interface ListItem {
  title: string;
  url: string;
  publishedAt?: Date;
}

function parseList(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  const seen = new Set<string>();

  $("a.box-category-link-title").each((_, el) => {
    const anchor = $(el);
    const href = anchor.attr("href");
    const title = anchor.attr("title")?.trim() || anchor.text().trim();
    if (!href || !title) return;

    const url = resolveUrl(href, LIST_URL);
    if (seen.has(url)) return;
    seen.add(url);

    const timeText = anchor
      .closest(".box-category-content")
      .find("span.time-ago")
      .attr("title");
    const publishedAt = timeText ? parseUSDateTime(timeText) : undefined;

    items.push({ title, url, publishedAt });
  });

  return items;
}

function parseDetail(html: string): string {
  const $ = cheerio.load(html);
  const body = $(".detail-content").first();
  return body.text().replace(/\s+/g, " ").trim();
}

export async function scrape(): Promise<RawDocument[]> {
  const listHtml = await fetchHTML(LIST_URL);
  const items = parseList(listHtml);
  const relevant = items.filter((item) => matchesCBKeywords(item.title));

  const results: RawDocument[] = [];
  for (const item of relevant) {
    try {
      const detailHtml = await fetchHTML(item.url);
      const rawContent = parseDetail(detailHtml);
      results.push({
        title: item.title,
        source_url: item.url,
        source_name: SOURCE_NAME,
        raw_content: rawContent || item.title,
        published_at: item.publishedAt ?? new Date(),
        doc_id_hint: extractDocIdHint(item.title),
      });
    } catch (err) {
      console.error(`[scraper:chinhphu] failed to fetch detail ${item.url}:`, err);
    }
  }

  return results;
}
