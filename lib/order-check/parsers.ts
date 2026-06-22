// ============================================================
// Parsers — parse text gọi hàng và bảng tồn kho
// ============================================================

import { AvailableSample, OrderItem } from "./types";
import {
  normalizeSize,
  normalizeName,
  cleanName,
  extractQuantity,
  DEFAULT_PREFIXES,
} from "./normalizers";

// ---- Parse text gọi hàng ----

/**
 * Parse đoạn text gọi hàng có dạng:
 *
 *   50cmx70cm: Tufted Da Báo (3), LC_Mèo 3 Sọc
 *   120cmx120cm: LC_01
 *
 * Trả về mảng OrderItem.
 */
export function parseOrderText(
  text: string,
  prefixes: string[] = DEFAULT_PREFIXES
): OrderItem[] {
  const items: OrderItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Tìm dấu ":" đầu tiên — trước là size, sau là danh sách mẫu
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const rawSize = line.slice(0, colonIdx).trim();
    const samplesStr = line.slice(colonIdx + 1).trim();

    if (!rawSize || !samplesStr) continue;

    const size = normalizeSize(rawSize);

    // Tách các mẫu bằng dấu phẩy
    const sampleNames = samplesStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const rawName of sampleNames) {
      const qty = extractQuantity(rawName);
      // rawName không có qty: "Tufted Da Báo (3)" -> "Tufted Da Báo"
      const rawNameNoQty = rawName.replace(/\s*\(\d+\)\s*$/, "").trim();

      items.push({
        size,
        rawName: rawNameNoQty,
        cleanName: cleanName(rawNameNoQty, prefixes),
        normalizedName: normalizeName(rawNameNoQty, prefixes),
        quantity: qty,
      });
    }
  }

  return items;
}

// ---- Parse Google Sheet / Excel (hàng ngang) ----

/**
 * Parse CSV string từ Google Sheet về dạng bảng ngang.
 *
 * Định dạng:
 *   Row 0: size headers (50x70, 60x90, ...)
 *   Row 1+: tên mẫu (có thể trống ở các ô cuối)
 *
 * Trả về mảng AvailableSample.
 */
export function parseInventoryCSV(
  csv: string,
  prefixes: string[] = DEFAULT_PREFIXES
): AvailableSample[] {
  const samples: AvailableSample[] = [];

  // Parse CSV đơn giản (hỗ trợ ô có dấu phẩy trong ngoặc kép)
  const rows = parseCSV(csv);
  if (rows.length < 2) return samples;

  // Row đầu là sizes
  const sizeRow = rows[0].map((s) => normalizeSize(s.trim()));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < sizeRow.length; c++) {
      const size = sizeRow[c];
      const rawName = (row[c] ?? "").trim();
      if (!size || !rawName) continue;

      samples.push({
        size,
        rawName,
        cleanName: cleanName(rawName, prefixes),
        normalizedName: normalizeName(rawName, prefixes),
        quantity: extractQuantity(rawName) > 1 ? extractQuantity(rawName) : undefined,
      });
    }
  }

  return samples;
}

/**
 * Parse bảng tồn kho từ Excel rows (đã được xlsx parse ra).
 * Mỗi row là object với key = tên cột (= size).
 */
export function parseInventoryRows(
  rows: Record<string, unknown>[],
  prefixes: string[] = DEFAULT_PREFIXES
): AvailableSample[] {
  const samples: AvailableSample[] = [];
  if (rows.length === 0) return samples;

  // Các key là size headers
  const sizeKeys = Object.keys(rows[0]);

  for (const row of rows) {
    for (const sizeKey of sizeKeys) {
      const size = normalizeSize(sizeKey.toString().trim());
      const rawName = (row[sizeKey] ?? "").toString().trim();
      if (!size || !rawName) continue;

      samples.push({
        size,
        rawName,
        cleanName: cleanName(rawName, prefixes),
        normalizedName: normalizeName(rawName, prefixes),
        quantity: extractQuantity(rawName) > 1 ? extractQuantity(rawName) : undefined,
      });
    }
  }

  return samples;
}

// ---- Simple CSV parser ----

/**
 * CSV parser đơn giản hỗ trợ:
 * - Ô có dấu phẩy trong ngoặc kép: "hello, world"
 * - CRLF và LF line endings
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.replace(/\r\n/g, "\n").split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    rows.push(cells);
  }

  return rows;
}
