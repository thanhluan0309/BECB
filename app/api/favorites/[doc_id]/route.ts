import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import dbConnect from "@/lib/mongodb";
import Favorite from "@/lib/models/Favorite";
import { updateFavoriteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ doc_id: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const { doc_id } = await params;
    const userId = request.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const deleted = await Favorite.findOneAndDelete({ user_id: userId, doc_id });
    if (!deleted) {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Đã xóa khỏi mục yêu thích" });
  } catch (err) {
    console.error("[api:favorites/:doc_id] DELETE failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const { doc_id } = await params;
    const userId = request.nextUrl.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ error: "user_id query param is required" }, { status: 400 });
    }

    const body = await request.json();
    const { note } = updateFavoriteSchema.parse(body);

    const favorite = await Favorite.findOneAndUpdate(
      { user_id: userId, doc_id },
      { $set: { note } },
      { new: true }
    ).lean();

    if (!favorite) {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Đã cập nhật ghi chú", data: favorite });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("[api:favorites/:doc_id] PATCH failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
