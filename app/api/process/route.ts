import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { processBali } from "@/lib/bali";
import { processCuu } from "@/lib/cuu";

export const runtime = "nodejs";

function readExcelRows(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  // Ưu tiên sheet "orders", nếu không có thì lấy sheet đầu tiên
  const sheetName = workbook.SheetNames.includes("orders")
    ? "orders"
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") as string; // "bali" | "cuu"
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Không có file nào được tải lên" }, { status: 400 });
    }

    let allRows: Record<string, unknown>[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const rows = readExcelRows(buffer);
      allRows = allRows.concat(rows);
    }

    let result: string;
    if (mode === "bali") {
      result = processBali(allRows);
    } else if (mode === "cuu") {
      result = processCuu(allRows);
    } else {
      return NextResponse.json({ error: "Mode không hợp lệ. Dùng 'bali' hoặc 'cuu'" }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Lỗi xử lý file: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
