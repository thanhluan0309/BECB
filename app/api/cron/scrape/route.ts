import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import dbConnect from "@/lib/mongodb";
import LawDocument from "@/lib/models/Document";
import { runAll } from "@/lib/scrapers";
import type { RawDocument } from "@/lib/scrapers/utils";
import { summarize } from "@/lib/ai/summarize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUMMARIZE_CONCURRENCY = 3;
const IS_NEW_TTL_MS = 24 * 60 * 60 * 1000;

function resolveDocId(raw: RawDocument): string {
  if (raw.doc_id_hint) return raw.doc_id_hint;
  const hash = crypto.createHash("sha1").update(raw.source_url).digest("hex").slice(0, 10);
  return `URL-${hash}`;
}

// Vercel Cron invokes the scheduled path with GET and auto-injects the
// Authorization header from CRON_SECRET; POST is kept for manual/spec-style
// triggering. Both share the same authenticated handler.
async function handleScrape(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];

  try {
    await dbConnect();

    const scraperResults = await runAll();
    for (const result of scraperResults) {
      if (result.error) errors.push(`[${result.source}] ${result.error}`);
    }

    const allRawDocs = scraperResults.flatMap((r) => r.documents);
    const scraped = allRawDocs.length;

    // Dedup by doc_id BEFORE calling Claude: within this batch, then against
    // documents already stored in MongoDB.
    const byDocId = new Map<string, RawDocument>();
    for (const raw of allRawDocs) {
      const docId = resolveDocId(raw);
      if (!byDocId.has(docId)) byDocId.set(docId, raw);
    }

    const candidateIds = Array.from(byDocId.keys());
    const existing = await LawDocument.find({ doc_id: { $in: candidateIds } })
      .select("doc_id")
      .lean();
    const existingIds = new Set(existing.map((d) => d.doc_id));

    const newEntries = candidateIds
      .filter((id) => !existingIds.has(id))
      .map((id) => [id, byDocId.get(id)!] as const);

    const limit = pLimit(SUMMARIZE_CONCURRENCY);
    const inserted: string[] = [];

    await Promise.all(
      newEntries.map(([docId, raw]) =>
        limit(async () => {
          try {
            const ai = await summarize(raw.raw_content);
            await LawDocument.create({
              doc_id: docId,
              title: raw.title,
              category: raw.category_hint ?? ai.category,
              summary: ai.summary,
              highlights: ai.highlights,
              source_url: raw.source_url,
              source_name: raw.source_name,
              effective_date: ai.effective_date ?? undefined,
              impact: ai.impact,
              published_at: raw.published_at,
              scraped_at: new Date(),
              is_new: true,
              raw_content: raw.raw_content,
            });
            inserted.push(docId);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`[doc:${docId}] ${message}`);
          }
        })
      )
    );

    const cleanupResult = await LawDocument.updateMany(
      { is_new: true, scraped_at: { $lt: new Date(Date.now() - IS_NEW_TTL_MS) } },
      { $set: { is_new: false } }
    );

    return NextResponse.json({
      scraped,
      new: inserted.length,
      errors,
      cleaned_up: cleanupResult.modifiedCount,
    });
  } catch (err) {
    console.error("[api:cron/scrape] fatal error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal server error", detail: message, errors }, { status: 500 });
  }
}

export const POST = handleScrape;
export const GET = handleScrape;
