import { NextRequest, NextResponse } from "next/server";
import { normalizeName } from "@/lib/order-check/normalizers";
import { upsertAlias } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/order-check/confirm-alias
 *
 * Body:
 *   { aliasRawName, targetRawName, confirmed }
 *
 * Nếu confirmed = true -> lưu alias vào DB.
 * Nếu confirmed = false -> không lưu (hoặc cập nhật confirmed_by_user = false).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { aliasRawName, targetRawName, confirmed, confidence = 0 } = body as {
      aliasRawName: string;
      targetRawName: string;
      confirmed: boolean;
      confidence?: number;
    };

    if (!aliasRawName || !targetRawName) {
      return NextResponse.json(
        { error: "Thiếu aliasRawName hoặc targetRawName" },
        { status: 400 }
      );
    }

    const aliasNorm = normalizeName(aliasRawName);
    const targetNorm = normalizeName(targetRawName);

    upsertAlias(
      aliasRawName,
      aliasNorm,
      targetRawName,
      targetNorm,
      confidence,
      confirmed
    );

    return NextResponse.json({
      success: true,
      message: confirmed
        ? `Đã lưu alias: "${aliasRawName}" → "${targetRawName}"`
        : `Đã xác nhận "${aliasRawName}" KHÔNG phải là "${targetRawName}"`,
    });
  } catch (err) {
    console.error("[order-check/confirm-alias]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
