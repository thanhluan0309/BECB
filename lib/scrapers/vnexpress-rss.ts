import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { fetchHTML, extractDocIdHint, matchesCBKeywords, type RawDocument } from "./utils";

const FEED_URL = "https://vnexpress.net/rss/phap-luat.rss";
const SOURCE_NAME = "VnExpress Pháp luật";

const parser = new Parser();

function stripHTML(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

async function tryFetchArticleBody(url: string): Promise<string | undefined> {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const text = $(".fck_detail").first().text().replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : undefined;
  } catch (err) {
    console.error(`[scraper:vnexpress-rss] failed to fetch article ${url}:`, err);
    return undefined;
  }
}

export async function scrape(): Promise<RawDocument[]> {
  const feed = await parser.parseURL(FEED_URL);
  const items = feed.items ?? [];

  const relevant = items.filter((item) => matchesCBKeywords(item.title ?? ""));

  const results: RawDocument[] = [];
  for (const item of relevant) {
    const title = item.title?.trim();
    const url = item.link?.trim();
    if (!title || !url) continue;

    const articleBody = await tryFetchArticleBody(url);
    const description = item.contentSnippet?.trim() || stripHTML(item.content ?? "");

    results.push({
      title,
      source_url: url,
      source_name: SOURCE_NAME,
      raw_content: articleBody ?? description ?? title,
      published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
      doc_id_hint: extractDocIdHint(title),
    });
  }

  return results;
}
