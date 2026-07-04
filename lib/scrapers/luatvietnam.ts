import * as cheerio from "cheerio";
import {
  fetchHTML,
  extractDocIdHint,
  matchesCBKeywords,
  parseVNDate,
  resolveUrl,
  type RawDocument,
} from "./utils";

const LIST_URL = "https://luatvietnam.vn/van-ban-moi.html";
const SOURCE_NAME = "LuatVietnam";

interface ListItem {
  title: string;
  url: string;
  publishedAt?: Date;
}

function parseList(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  const seen = new Set<string>();

  $("article.doc-article").each((_, el) => {
    const article = $(el);
    const anchor = article.find("h2.doc-title a").first();
    const href = anchor.attr("href");
    const title = (anchor.attr("title") || anchor.text()).replace(/\s+/g, " ").trim();
    if (!href || !title) return;

    const url = resolveUrl(href, LIST_URL);
    if (seen.has(url)) return;
    seen.add(url);

    let publishedAt: Date | undefined;
    article.find(".doc-dmy").each((_, dmyEl) => {
      const dmy = $(dmyEl);
      const label = dmy.find(".w-doc-dmy1").text().trim();
      if (/Ban hành/i.test(label)) {
        const value = dmy.find(".w-doc-dmy2").text().trim();
        publishedAt = parseVNDate(value);
      }
    });

    items.push({ title, url, publishedAt });
  });

  return items;
}

function parseDetail(html: string): string {
  const $ = cheerio.load(html);
  const parts: string[] = [];

  const heading = $("h1.the-document-title").first().text().trim();
  if (heading) parts.push(heading);

  $(".div-table table tr").each((_, row) => {
    const rowText = $(row).text().replace(/\s+/g, " ").trim();
    if (rowText) parts.push(rowText);
  });

  const summary = $(".the-document-body.doc-summary").first().text().replace(/\s+/g, " ").trim();
  if (summary) parts.push(summary);

  return parts.join("\n");
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
      console.error(`[scraper:luatvietnam] failed to fetch detail ${item.url}:`, err);
    }
  }

  return results;
}
