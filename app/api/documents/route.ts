import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import LawDocument, { CATEGORIES, type Category } from "@/lib/models/Document";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const offset = parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10);
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64");
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const sort = searchParams.get("sort") ?? "newest";
    const search = searchParams.get("search");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const offset = decodeCursor(searchParams.get("cursor"));

    const filter: Record<string, unknown> = {};

    if (category) {
      if (!CATEGORIES.includes(category as Category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      filter.category = category;
    }

    if (search) {
      filter.$text = { $search: search };
    }

    if (sort === "effective") {
      filter.effective_date = { $gt: new Date() };
    }

    const total = await LawDocument.countDocuments(filter);

    let data;
    if (sort === "impact") {
      data = await LawDocument.aggregate([
        { $match: filter },
        {
          $addFields: {
            impact_rank: {
              $switch: {
                branches: [
                  { case: { $eq: ["$impact", "HIGH"] }, then: 0 },
                  { case: { $eq: ["$impact", "MEDIUM"] }, then: 1 },
                  { case: { $eq: ["$impact", "LOW"] }, then: 2 },
                ],
                default: 3,
              },
            },
          },
        },
        { $sort: { impact_rank: 1, published_at: -1 } },
        { $skip: offset },
        { $limit: limit },
        { $project: { impact_rank: 0 } },
      ]);
    } else {
      const sortSpec: Record<string, 1 | -1> =
        sort === "effective" ? { effective_date: 1 } : { published_at: -1 };

      data = await LawDocument.find(filter).sort(sortSpec).skip(offset).limit(limit).lean();
    }

    const nextOffset = offset + data.length;
    const next_cursor = nextOffset < total ? encodeCursor(nextOffset) : null;

    return NextResponse.json({ data, next_cursor, total });
  } catch (err) {
    console.error("[api:documents] GET failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
