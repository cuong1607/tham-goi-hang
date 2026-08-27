// ============================================================
// Parsers cho module Sinh Ảnh Gọi Hàng Thảm Cừu To
// ============================================================
// Thảm Cừu không có group — chỉ có dòng "size: mã, mã(qty)"

import { CuuImageOrderItem, CuuImageAggregated, CuuSizeEntry } from "./types";
import {
  normalizeSize,
  normalizePattern,
  cleanPattern,
  extractQuantity,
  formatDisplaySize,
  formatDisplayName,
  buildSizeSummary,
  sizeOrderIndex,
} from "./normalizers";

// ============================================================
// Split patterns in a cell (comma-separated, parens-aware)
// ============================================================

function splitPatterns(cell: string): string[] {
  const results: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of cell) {
    if (ch === "(") { depth++; current += ch; }
    else if (ch === ")") { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === "," && depth === 0) {
      const t = current.trim();
      if (t) results.push(t);
      current = "";
    } else { current += ch; }
  }
  const last = current.trim();
  if (last) results.push(last);
  return results;
}

// ============================================================
// Parse text gọi hàng thảm Cừu To
// ============================================================

/**
 * Parse đoạn text gọi hàng thảm Cừu To (không có group header):
 *
 *   80cmx120cm: LC_1%, LC_Cầu Vồng
 *   120cmx160cm: LC_100%(2)
 *
 * Trả về mảng CuuImageOrderItem (chưa aggregate).
 */
export function parseOrderText(text: string): CuuImageOrderItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: CuuImageOrderItem[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue; // Bỏ qua dòng không có ':'

    const rawSize = line.slice(0, colonIdx).trim();
    const patternsStr = line.slice(colonIdx + 1).trim();
    if (!rawSize || !patternsStr) continue;

    const size = normalizeSize(rawSize);
    const patterns = splitPatterns(patternsStr);

    for (const raw of patterns) {
      const rawTrimmed = raw.trim();
      if (!rawTrimmed) continue;
      const qty = extractQuantity(rawTrimmed);
      const clean = cleanPattern(rawTrimmed);

      items.push({
        pattern: clean,
        normalizedPattern: normalizePattern(clean),
        size,
        quantity: qty,
      });
    }
  }

  return items;
}

// ============================================================
// Aggregate theo pattern
// ============================================================

/**
 * Gom các item theo normalizedPattern.
 * Nếu cùng pattern + size → cộng quantity.
 * 1 pattern = 1 ảnh.
 *
 * @param sourceImageFinder - hàm tra xem có ảnh không (optional)
 */
export function aggregateByPattern(
  items: CuuImageOrderItem[],
  sourceImageFinder?: (pattern: string) => string | null
): CuuImageAggregated[] {
  type AggrEntry = {
    pattern: string;
    normalizedPattern: string;
    sizeMap: Map<string, number>;
  };

  const map = new Map<string, AggrEntry>();

  for (const item of items) {
    const key = item.normalizedPattern;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        pattern: item.pattern,
        normalizedPattern: item.normalizedPattern,
        sizeMap: new Map(),
      };
      map.set(key, entry);
    }
    const existing = entry.sizeMap.get(item.size) ?? 0;
    entry.sizeMap.set(item.size, existing + item.quantity);
  }

  const result: CuuImageAggregated[] = [];

  for (const entry of Array.from(map.values())) {
    const sizes: CuuSizeEntry[] = Array.from(entry.sizeMap.entries())
      .sort(([a], [b]) => sizeOrderIndex(a) - sizeOrderIndex(b))
      .map(([size, quantity]) => ({
        size,
        displaySize: formatDisplaySize(size),
        quantity,
      }));

    const sizeSummary = buildSizeSummary(
      sizes.map((s) => ({ size: s.size, quantity: s.quantity }))
    );

    const sourceImagePath = sourceImageFinder
      ? sourceImageFinder(entry.pattern)
      : null;

    result.push({
      pattern: entry.pattern,
      normalizedPattern: entry.normalizedPattern,
      caption: formatDisplayName(entry.pattern),
      sizes,
      sizeSummary,
      sourceImagePath,
      fileName: `CUU_${entry.pattern}.jpg`,
    });
  }

  return result;
}
