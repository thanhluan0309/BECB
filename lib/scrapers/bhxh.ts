import * as cheerio from "cheerio";
import { fetchHTML, extractDocIdHint, parseVNDate, resolveUrl, type RawDocument } from "./utils";

const LIST_URL = "https://baohiemxahoi.gov.vn/tintuc/Pages/linh-vuc-bao-hiem-xa-hoi.aspx";
const SOURCE_NAME = "Bảo hiểm xã hội Việt Nam";

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

  $("p.p-tieude").each((_, el) => {
    const titleEl = $(el);
    const title = titleEl.text().replace(/\s+/g, " ").trim();
    const href = titleEl.closest("a").attr("href");
    if (!title || !href) return;

    const url = resolveUrl(href, LIST_URL);
    if (seen.has(url)) return;
    seen.add(url);

    const container = titleEl.closest(".col-xs-7, .col-xs-12");
    const timeText = container.find("p.time").first().text().trim();
    const publishedAt = timeText ? parseVNDate(timeText) : undefined;
    const summary = container.find("p.tomtat").first().text().replace(/\s+/g, " ").trim();

    items.push({ title, url, publishedAt, summary });
  });

  return items;
}

function parseDetail(html: string): string {
  const $ = cheerio.load(html);
  const body = $("#contenttin").first();
  return body.text().replace(/\s+/g, " ").trim();
}

export async function scrape(): Promise<RawDocument[]> {
  const listHtml = await fetchHTML(LIST_URL);
  const items = parseList(listHtml);

  const results: RawDocument[] = [];
  for (const item of items) {
    try {
      const detailHtml = await fetchHTML(item.url);
      const rawContent = parseDetail(detailHtml);
      results.push({
        title: item.title,
        source_url: item.url,
        source_name: SOURCE_NAME,
        raw_content: rawContent || item.summary || item.title,
        published_at: item.publishedAt ?? new Date(),
        doc_id_hint: extractDocIdHint(item.title),
        category_hint: "BHXH",
      });
    } catch (err) {
      console.error(`[scraper:bhxh] failed to fetch detail ${item.url}:`, err);
    }
  }

  return results;
}
