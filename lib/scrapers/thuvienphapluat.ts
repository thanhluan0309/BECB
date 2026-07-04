import * as cheerio from "cheerio";
import {
  fetchHTML,
  extractDocIdHint,
  matchesCBKeywords,
  parseVNDate,
  resolveUrl,
  type RawDocument,
} from "./utils";

const LIST_URL = "https://thuvienphapluat.vn/van-ban-moi";
const SOURCE_NAME = "Thư viện Pháp luật";

interface ListItem {
  title: string;
  url: string;
  publishedAt?: Date;
}

function parseList(html: string): ListItem[] {
  const $ = cheerio.load(html);
  const items: ListItem[] = [];
  const seen = new Set<string>();

  $("div[class^='content-']").each((_, el) => {
    const block = $(el);
    const anchor = block.find("h2.nqTitle a").first();
    const href = anchor.attr("href");
    const title = anchor.text().replace(/\s+/g, " ").trim();
    if (!href || !title) return;

    const url = resolveUrl(href, LIST_URL);
    if (seen.has(url)) return;
    seen.add(url);

    const rightColText = block.find(".right-col").text();
    const issuedMatch = rightColText.match(/Ban hành:\s*([\d/]+)/);
    const publishedAt = issuedMatch ? parseVNDate(issuedMatch[1]) : undefined;

    items.push({ title, url, publishedAt });
  });

  return items;
}

/**
 * Detail pages on thuvienphapluat.vn sit behind a Cloudflare bot challenge and
 * frequently return 403 for plain server-side requests. We try once and fall
 * back to the listing title/metadata as raw_content rather than failing the
 * whole document — this keeps the scraper resilient per CRITICAL REQUIREMENTS.
 */
async function tryFetchDetailText(url: string): Promise<string | undefined> {
  try {
    const html = await fetchHTML(url, 0);
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : undefined;
  } catch {
    return undefined;
  }
}

export async function scrape(): Promise<RawDocument[]> {
  const listHtml = await fetchHTML(LIST_URL);
  const items = parseList(listHtml);
  const relevant = items.filter((item) => matchesCBKeywords(item.title));

  const results: RawDocument[] = [];
  for (const item of relevant) {
    const detailText = await tryFetchDetailText(item.url);
    results.push({
      title: item.title,
      source_url: item.url,
      source_name: SOURCE_NAME,
      raw_content: detailText ?? item.title,
      published_at: item.publishedAt ?? new Date(),
      doc_id_hint: extractDocIdHint(item.title),
    });
  }

  return results;
}
