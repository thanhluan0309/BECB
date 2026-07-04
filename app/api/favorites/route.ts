import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import dbConnect from "@/lib/mongodb";
import Favorite from "@/lib/models/Favorite";
import LawDocument from "@/lib/models/Document";
import { createFavoriteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = request.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const favorites = await Favorite.find({ user_id: userId }).sort({ saved_at: -1 }).lean();
    const docIds = favorites.map((f) => f.doc_id);
    const documents = await LawDocument.find({ doc_id: { $in: docIds } }).lean();
    const documentsByDocId = new Map(documents.map((doc) => [doc.doc_id, doc]));

    const data = favorites
      .map((favorite) => {
        const document = documentsByDocId.get(favorite.doc_id);
        if (!document) return null;
        return { ...favorite, document };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error("[api:favorites] GET failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { user_id, doc_id, note } = createFavoriteSchema.parse(body);

    const document = await LawDocument.findOne({ doc_id }).lean();
    if (!document) {
      return NextResponse.json({ error: `Document ${doc_id} not found` }, { status: 404 });
    }

    const favorite = await Favorite.findOneAndUpdate(
      { user_id, doc_id },
      { $set: { note }, $setOnInsert: { saved_at: new Date() } },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({
      message: "Đã lưu vào mục yêu thích",
      data: { ...favorite, document },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("[api:favorites] POST failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
