import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  let mongodb: "connected" | "error" = "connected";
  let mongodbError: string | undefined;

  try {
    const conn = await dbConnect();
    if (conn.connection.readyState !== 1) {
      throw new Error(`Unexpected readyState: ${conn.connection.readyState}`);
    }
  } catch (err) {
    mongodb = "error";
    mongodbError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(
    {
      status: mongodb === "connected" ? "ok" : "degraded",
      service: "C&B Law Radar API",
      time: new Date().toISOString(),
      mongodb,
      ...(mongodbError ? { mongodb_error: mongodbError } : {}),
    },
    { status: mongodb === "connected" ? 200 : 503 }
  );
}
