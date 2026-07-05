import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { fetchHTML, extractDocIdHint, matchesCBKeywords, type RawDocument } from "./utils";

interface RSSSource {
  feedUrl: string;
  sourceName: string;
  /** Cheerio selector for the full article body on this source's detail pages. */
  bodySelector: string;
}

const SOURCES: RSSSource[] = [
  {
    feedUrl: "https://vnexpress.net/rss/phap-luat.rss",
    sourceName: "VnExpress Pháp luật",
    bodySelector: ".fck_detail",
  },
  {
    // The brief's "thue-va-cuoc-song.rss" 404s; CafeF's real feed is a
    // single general feed, filtered like every other source via CB_KEYWORDS.
    feedUrl: "https://cafef.vn/home.rss",
    sourceName: "cafef.vn",
    bodySelector: ".detail-content",
  },
  {
    // laodong.vn is behind bot protection — every request (even the
    // homepage) returns a JS cookie-and-reload challenge stub instead of
    // real content, so this consistently yields 0 items. Kept in case the
    // site's protection changes; failures here are caught and logged, not
    // thrown, per the "never crash the batch" requirement.
    feedUrl: "https://laodong.vn/rss/tien-luong-lao-dong.rss",
    sourceName: "laodong.vn",
    bodySelector: ".article__body, .detail-content",
  },
];

const parser = new Parser();

function stripHTML(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

async function tryFetchArticleBody(url: string, bodySelector: string): Promise<string | undefined> {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const text = $(bodySelector).first().text().replace(/\s+/g, " ").trim();
    return text.length > 0 ? text : undefined;
  } catch (err) {
    console.error(`[scraper:rss] failed to fetch article ${url}:`, err);
    return undefined;
  }
}

async function scrapeSource(source: RSSSource): Promise<RawDocument[]> {
  let items: Parser.Item[];
  try {
    const feed = await parser.parseURL(source.feedUrl);
    items = feed.items ?? [];
  } catch (err) {
    console.error(`[scraper:rss] failed to fetch/parse feed ${source.feedUrl}:`, err);
    return [];
  }

  // Match on title OR description — a headline alone often misses topical
  // pieces where the C&B angle only shows up in the summary text.
  const relevant = items.filter((item) => {
    const description = item.contentSnippet?.trim() || stripHTML(item.content ?? "");
    return matchesCBKeywords(item.title ?? "") || matchesCBKeywords(description);
  });

  const results: RawDocument[] = [];
  for (const item of relevant) {
    const title = item.title?.trim();
    const url = item.link?.trim();
    if (!title || !url) continue;

    const articleBody = await tryFetchArticleBody(url, source.bodySelector);
    const description = item.contentSnippet?.trim() || stripHTML(item.content ?? "");

    results.push({
      title,
      source_url: url,
      source_name: source.sourceName,
      raw_content: articleBody ?? description ?? title,
      published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
      doc_id_hint: extractDocIdHint(title),
    });
  }

  return results;
}

export async function scrape(): Promise<RawDocument[]> {
  const perSource = await Promise.all(SOURCES.map(scrapeSource));
  return perSource.flat();
}
