import { NextRequest, NextResponse } from "next/server";
import XLSX from "xlsx";
import { parseInventoryMatrix, parseInventoryRows, parseOrderText } from "@/lib/bali-check/parsers";
import { compareBaliOrders } from "@/lib/bali-check/matcher";
import { getBaliSettings } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const orderText = (formData.get("orderText") as string | null)?.trim() ?? "";
    const googleSheetUrl = (formData.get("googleSheetUrl") as string | null)?.trim() ?? "";
    const file = formData.get("file") as File | null;

    if (!orderText) {
      return NextResponse.json({ error: "Vui lòng nhập text gọi hàng." }, { status: 400 });
    }

    // --- Lấy nguồn dữ liệu tồn kho ---
    let inventorySource = "";
    let inventoryCSV = "";
    let inventoryRows: unknown[][] | null = null;

    if (file) {
      // Upload file
      inventorySource = file.name;
      const arrayBuffer = await file.arrayBuffer();

      if (file.name.endsWith(".csv")) {
        inventoryCSV = new TextDecoder("utf-8").decode(arrayBuffer);
      } else {
        // xlsx
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        inventoryRows = (XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown) as unknown[][];
      }
    } else {
      // Google Sheet URL
      let sheetUrl = googleSheetUrl;
      if (!sheetUrl) {
        // Thử lấy từ DB
        const settings = getBaliSettings();
        sheetUrl = settings.google_sheet_url;
      }

      if (!sheetUrl) {
        return NextResponse.json(
          { error: "Vui lòng cung cấp Google Sheet URL hoặc upload file .xlsx/.csv." },
          { status: 400 }
        );
      }

      // Chuyển URL edit → CSV export (server-side để tránh CORS)
      inventorySource = sheetUrl;
      const csvUrl = convertToCSVUrl(sheetUrl);

      const resp = await fetch(csvUrl);
      if (!resp.ok) {
        return NextResponse.json(
          { error: `Không thể đọc Google Sheet. HTTP ${resp.status}. Hãy kiểm tra URL và quyền truy cập (phải ở chế độ "Anyone with the link").` },
          { status: 400 }
        );
      }
      inventoryCSV = await resp.text();
    }

    // --- Parse inventory ---
    const inventory = inventoryRows
      ? parseInventoryRows(inventoryRows)
      : parseInventoryMatrix(inventoryCSV);

    if (inventory.length === 0) {
      return NextResponse.json(
        { error: "Không parse được dữ liệu tồn kho. Hãy kiểm tra format Sheet (cột A = group, hàng 1 = sizes)." },
        { status: 400 }
      );
    }

    // --- Parse order text ---
    const orders = parseOrderText(orderText);

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "Không parse được text gọi hàng. Hãy kiểm tra định dạng (GROUP\nsize: mã)." },
        { status: 400 }
      );
    }

    // --- Compare ---
    const result = compareBaliOrders(orders, inventory);

    return NextResponse.json({
      ...result,
      inventorySource,
      inventoryCount: inventory.length,
      orderCount: orders.length,
    });
  } catch (err) {
    console.error("[bali-check/compare]", err);
    return NextResponse.json(
      { error: "Lỗi server: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

/**
 * Chuyển Google Sheet URL dạng edit/view thành CSV export URL.
 * Hỗ trợ:
 *   https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
 *   https://docs.google.com/spreadsheets/d/{ID}/edit?gid={GID}
 *   https://docs.google.com/spreadsheets/d/{ID}
 */
function convertToCSVUrl(url: string): string {
  // Lấy Spreadsheet ID
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!idMatch) return url;
  const spreadsheetId = idMatch[1];

  // Lấy GID nếu có
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}
