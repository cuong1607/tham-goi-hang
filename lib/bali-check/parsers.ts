// ============================================================
// Parsers cho module Đối soát Gọi Hàng Thảm Bali To
// ============================================================

import { BaliAvailableItem, BaliOrderItem } from "./types";
import {
  normalizeGroup,
  normalizeSize,
  normalizePattern,
  cleanPattern,
  extractPatternQuantity,
} from "./normalizers";

// ============================================================
// Parse Sheet ma trận tồn kho
// ============================================================

/**
 * Parse CSV string từ Google Sheet dạng ma trận.
 *
 * Cấu trúc:
 *   - Ô A1: có thể trống hoặc là header (bỏ qua)
 *   - Hàng 1 từ cột B trở đi: size headers (200cmx300cm, 160cmx230cm, ...)
 *   - Cột A từ hàng 2 trở đi: group names (BACAU, NT, NTNEW, ...)
 *   - Các ô còn lại: danh sách pattern cách nhau bằng dấu phẩy
 *     Ví dụ: "01,05,14(3),45(2),ngẫu nhiên"
 *
 * Trả về mảng BaliAvailableItem (đã aggregate nếu trùng key).
 */
export function parseInventoryMatrix(csv: string): BaliAvailableItem[] {
  const rows = parseCSV(csv);
  if (rows.length < 2) return [];

  // Row 0: sizes (cột B trở đi)
  const sizeHeaders = rows[0].slice(1).map((s) => normalizeSize(s.trim()));

  const items: BaliAvailableItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawGroup = (row[0] ?? "").trim();
    if (!rawGroup) continue;

    const group = normalizeGroup(rawGroup);

    for (let c = 0; c < sizeHeaders.length; c++) {
      const size = sizeHeaders[c];
      if (!size) continue;

      const cellRaw = (row[c + 1] ?? "").trim();
      if (!cellRaw) continue;

      // Parse từng pattern trong ô (cách nhau bằng dấu phẩy)
      const patterns = splitPatterns(cellRaw);
      for (const rawPat of patterns) {
        const raw = rawPat.trim();
        if (!raw) continue;

        items.push({
          group,
          size,
          rawPattern: raw,
          cleanPattern: cleanPattern(raw),
          normalizedPattern: normalizePattern(raw),
          availableQuantity: extractPatternQuantity(raw),
        });
      }
    }
  }

  // Aggregate: cùng key → cộng availableQuantity
  return aggregateInventory(items);
}

/**
 * Parse từ Excel rows (đã được xlsx parse ra dạng object).
 * Hỗ trợ header: 1 option (rows là mảng mảng).
 */
export function parseInventoryRows(
  rawRows: unknown[][]
): BaliAvailableItem[] {
  if (rawRows.length < 2) return [];

  // Row 0 là header: [groupHeader?, size1, size2, ...]
  const headerRow = rawRows[0] as string[];
  const sizeHeaders = headerRow.slice(1).map((s) => normalizeSize(String(s ?? "").trim()));

  const items: BaliAvailableItem[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r] as string[];
    const rawGroup = String(row[0] ?? "").trim();
    if (!rawGroup) continue;

    const group = normalizeGroup(rawGroup);

    for (let c = 0; c < sizeHeaders.length; c++) {
      const size = sizeHeaders[c];
      if (!size) continue;

      const cellRaw = String(row[c + 1] ?? "").trim();
      if (!cellRaw) continue;

      const patterns = splitPatterns(cellRaw);
      for (const rawPat of patterns) {
        const raw = rawPat.trim();
        if (!raw) continue;

        items.push({
          group,
          size,
          rawPattern: raw,
          cleanPattern: cleanPattern(raw),
          normalizedPattern: normalizePattern(raw),
          availableQuantity: extractPatternQuantity(raw),
        });
      }
    }
  }

  return aggregateInventory(items);
}

// ============================================================
// Parse text gọi hàng thảm Bali To
// ============================================================

/**
 * Parse đoạn text gọi hàng dạng:
 *
 *   BACAU
 *   80cmx150cm: 17
 *   80cmx200cm: 08
 *   120cmx160cm: 17
 *
 *   NT
 *   120cmx160cm: 02
 *   140cmx200cm: 02, 11
 *
 * Quy tắc:
 * - Dòng không có ":" → là group header
 * - Dòng có ":" → size: danh sách pattern
 *
 * Trả về mảng BaliOrderItem (đã aggregate nếu trùng key).
 */
export function parseOrderText(text: string): BaliOrderItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: BaliOrderItem[] = [];
  let currentGroup = "";

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Dòng này là group header
      currentGroup = normalizeGroup(line);
    } else {
      // Dòng này là size: patterns
      if (!currentGroup) continue;

      const rawSize = line.slice(0, colonIdx).trim();
      const patternsStr = line.slice(colonIdx + 1).trim();
      if (!rawSize || !patternsStr) continue;

      const size = normalizeSize(rawSize);
      const patterns = splitPatterns(patternsStr);

      for (const rawPat of patterns) {
        const raw = rawPat.trim();
        if (!raw) continue;

        items.push({
          group: currentGroup,
          size,
          rawPattern: raw,
          cleanPattern: cleanPattern(raw),
          normalizedPattern: normalizePattern(raw),
          orderQuantity: extractPatternQuantity(raw),
        });
      }
    }
  }

  // Aggregate: cùng key → cộng orderQuantity
  return aggregateOrders(items);
}

// ============================================================
// Aggregate helpers
// ============================================================

function makeKey(group: string, size: string, normalizedPattern: string): string {
  return `${group}|||${size}|||${normalizedPattern}`;
}

function aggregateInventory(items: BaliAvailableItem[]): BaliAvailableItem[] {
  const map = new Map<string, BaliAvailableItem>();
  for (const item of items) {
    const key = makeKey(item.group, item.size, item.normalizedPattern);
    const existing = map.get(key);
    if (existing) {
      existing.availableQuantity += item.availableQuantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

function aggregateOrders(items: BaliOrderItem[]): BaliOrderItem[] {
  const map = new Map<string, BaliOrderItem>();
  for (const item of items) {
    const key = makeKey(item.group, item.size, item.normalizedPattern);
    const existing = map.get(key);
    if (existing) {
      existing.orderQuantity += item.orderQuantity;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

// ============================================================
// Split patterns in a cell (comma-separated, but commas inside
// parentheses should NOT split)
// ============================================================

/**
 * Tách các pattern trong một ô bằng dấu phẩy.
 * Không tách nếu dấu phẩy nằm trong ngoặc (ít gặp nhưng cẩn thận).
 */
function splitPatterns(cell: string): string[] {
  const results: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of cell) {
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === "," && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) results.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) results.push(last);
  return results;
}

// ============================================================
// Simple CSV parser
// ============================================================

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
