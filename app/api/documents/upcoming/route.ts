import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import LawDocument, { type ILawDocument } from "@/lib/models/Document";

export const dynamic = "force-dynamic";

function monthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function GET() {
  try {
    await dbConnect();

    const documents = await LawDocument.find({ effective_date: { $gt: new Date() } })
      .sort({ effective_date: 1 })
      .lean<ILawDocument[]>();

    const grouped = new Map<string, ILawDocument[]>();
    for (const doc of documents) {
      const key = monthKey(new Date(doc.effective_date as Date));
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(doc);
    }

    const data = Array.from(grouped.entries()).map(([year_month, docs]) => ({
      year_month,
      documents: docs,
    }));

    return NextResponse.json({ data, total: documents.length });
  } catch (err) {
    console.error("[api:documents/upcoming] GET failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
