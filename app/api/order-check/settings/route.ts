import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/order-check/settings — lấy Google Sheet URL đã lưu */
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json({ googleSheetUrl: settings.google_sheet_url });
  } catch (err) {
    console.error("[order-check/settings GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}

/** POST /api/order-check/settings — lưu Google Sheet URL */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { googleSheetUrl } = body as { googleSheetUrl: string };

    if (typeof googleSheetUrl !== "string") {
      return NextResponse.json({ error: "Thiếu googleSheetUrl" }, { status: 400 });
    }

    saveSettings(googleSheetUrl.trim());
    return NextResponse.json({ success: true, message: "Đã lưu Google Sheet URL" });
  } catch (err) {
    console.error("[order-check/settings POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
