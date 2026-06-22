import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  parseOrderText,
  parseInventoryCSV,
  parseInventoryRows,
} from "@/lib/order-check/parsers";
import { compareOrders } from "@/lib/order-check/matcher";
import { getAllAliases, saveHistory } from "@/lib/db";

export const runtime = "nodejs";

/** Extract spreadsheetId và gid từ Google Sheet URL */
function extractSheetParams(url: string): { spreadsheetId: string; gid: string } | null {
  try {
    // Hỗ trợ cả /edit và /view
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) return null;

    const spreadsheetId = idMatch[1];

    // gid có thể ở query string hoặc hash
    let gid = "0";
    const hashGid = url.match(/[#&?]gid=(\d+)/);
    if (hashGid) gid = hashGid[1];

    return { spreadsheetId, gid };
  } catch {
    return null;
  }
}

/** Fetch CSV từ Google Sheet (server-side để tránh CORS) */
async function fetchGoogleSheetCSV(url: string): Promise<string> {
  const params = extractSheetParams(url);
  if (!params) {
    throw new Error("URL Google Sheet không hợp lệ. Vui lòng kiểm tra lại.");
  }

  const { spreadsheetId, gid } = params;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;

  const res = await fetch(csvUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(
      `Không thể đọc Google Sheet (HTTP ${res.status}). Kiểm tra quyền truy cập: sheet phải được chia sẻ "Anyone with the link - Viewer".`
    );
  }

  return res.text();
}

/** Đọc Excel/CSV file thành AvailableSample[] */
async function parseFileInventory(file: File) {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".csv")) {
    const csv = buffer.toString("utf-8");
    return parseInventoryCSV(csv);
  }

  if (name.endsWith(".xlsx")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Đọc dạng mảng để giữ hàng đầu là header
    const rows = (XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      header: 1,
    }) as unknown) as unknown[][];

    if (rows.length < 2) return [];

    // Row 0 = sizes, rows 1+ = tên mẫu
    const sizeRow = rows[0] as string[];
    const dataRows = rows.slice(1) as string[][];

    // Chuyển thành object rows để parseInventoryRows xử lý
    const objectRows: Record<string, unknown>[] = dataRows.map((row) => {
      const obj: Record<string, unknown> = {};
      sizeRow.forEach((size, i) => {
        if (size) obj[size] = row[i] ?? "";
      });
      return obj;
    });

    return parseInventoryRows(objectRows);
  }

  throw new Error("File không được hỗ trợ. Chỉ chấp nhận .xlsx hoặc .csv");
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let orderText = "";
    let googleSheetUrl = "";
    let uploadedFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      orderText = (formData.get("orderText") as string) ?? "";
      googleSheetUrl = (formData.get("googleSheetUrl") as string) ?? "";
      uploadedFile = (formData.get("file") as File) || null;
    } else {
      const body = await req.json();
      orderText = body.orderText ?? "";
      googleSheetUrl = body.googleSheetUrl ?? "";
    }

    if (!orderText.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập đoạn text gọi hàng." }, { status: 400 });
    }

    // Kiểm tra nguồn dữ liệu
    const hasSheetUrl = googleSheetUrl.trim().length > 0;
    const hasFile = uploadedFile !== null;

    if (!hasSheetUrl && !hasFile) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp Google Sheet URL hoặc upload file .xlsx/.csv." },
        { status: 400 }
      );
    }

    if (hasSheetUrl && hasFile) {
      return NextResponse.json(
        { error: "Vui lòng chỉ chọn một nguồn dữ liệu: Google Sheet URL HOẶC file upload." },
        { status: 400 }
      );
    }

    // Parse inventory
    let inventorySource = "";
    let inventory;
    if (hasFile) {
      inventory = await parseFileInventory(uploadedFile!);
      inventorySource = `file:${uploadedFile!.name}`;
    } else {
      const csv = await fetchGoogleSheetCSV(googleSheetUrl);
      inventory = parseInventoryCSV(csv);
      inventorySource = `sheet:${googleSheetUrl}`;
    }

    // Parse order text
    const orders = parseOrderText(orderText);

    // Load aliases từ DB
    const aliases = getAllAliases();

    // So sánh
    const result = compareOrders(orders, inventory, aliases);

    // Lưu history
    try {
      saveHistory(orderText, inventorySource, result);
    } catch {
      // Không block kết quả nếu lưu history lỗi
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[order-check/compare]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
