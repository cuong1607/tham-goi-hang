import { NextRequest, NextResponse } from "next/server";
import { getBaliSettings, saveBaliSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getBaliSettings();
    return NextResponse.json({ googleSheetUrl: settings.google_sheet_url });
  } catch (err) {
    console.error("[bali-check/settings GET]", err);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = (body.googleSheetUrl ?? "").trim();
    if (!url) {
      return NextResponse.json({ error: "URL không được để trống." }, { status: 400 });
    }
    saveBaliSettings(url);
    return NextResponse.json({ ok: true, message: "Đã lưu Google Sheet URL." });
  } catch (err) {
    console.error("[bali-check/settings POST]", err);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
