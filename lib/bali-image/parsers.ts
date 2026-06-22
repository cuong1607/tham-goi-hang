// ============================================================
// Parsers cho module Sinh Ảnh Gọi Hàng Thảm Bali To
// ============================================================

import { BaliImageOrderItem, BaliImageAggregated, BaliSizeEntry } from "./types";
import {
  normalizeGroup,
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
// Parse text gọi hàng
// ============================================================

/**
 * Parse đoạn text gọi hàng thảm Bali To:
 *
 *   BACAU
 *   80cmx200cm: 06, 08(2)
 *   120cmx160cm: 08, 17
 *
 * Trả về mảng BaliImageOrderItem (chưa aggregate).
 */
export function parseOrderText(text: string): BaliImageOrderItem[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: BaliImageOrderItem[] = [];
  let currentGroup = "";

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      // Group header line
      currentGroup = normalizeGroup(line);
    } else {
      if (!currentGroup) continue;
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
          group: currentGroup,
          pattern: clean,
          normalizedPattern: normalizePattern(clean),
          size,
          quantity: qty,
        });
      }
    }
  }

  return items;
}

// ============================================================
// Aggregate theo group + pattern
// ============================================================

/**
 * Gom các item theo group + normalizedPattern.
 * Nếu cùng group + pattern + size → cộng quantity.
 * Nếu cùng group + pattern khác size → ghép vào sizes[].
 *
 * 1 pattern = 1 ảnh, bất kể có bao nhiêu size.
 *
 * @param sourceImageFinder - hàm tra xem có ảnh không (optional)
 */
export function aggregateByPattern(
  items: BaliImageOrderItem[],
  sourceImageFinder?: (group: string, pattern: string) => string | null
): BaliImageAggregated[] {
  // Key: group|||normalizedPattern
  type AggrEntry = {
    group: string;
    pattern: string;           // raw pattern (giữ nguyên để hiển thị)
    normalizedPattern: string;
    // size → quantity
    sizeMap: Map<string, number>;
  };

  const map = new Map<string, AggrEntry>();

  for (const item of items) {
    const key = `${item.group}|||${item.normalizedPattern}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        group: item.group,
        pattern: item.pattern,
        normalizedPattern: item.normalizedPattern,
        sizeMap: new Map(),
      };
      map.set(key, entry);
    }
    // Cộng quantity nếu cùng size
    const existing = entry.sizeMap.get(item.size) ?? 0;
    entry.sizeMap.set(item.size, existing + item.quantity);
  }

  const result: BaliImageAggregated[] = [];

  for (const entry of Array.from(map.values())) {
    // Build sorted sizes[]
    const sizes: BaliSizeEntry[] = Array.from(entry.sizeMap.entries())
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
      ? sourceImageFinder(entry.group, entry.pattern)
      : null;

    result.push({
      group: entry.group,
      pattern: entry.pattern,
      normalizedPattern: entry.normalizedPattern,
      caption: formatDisplayName(entry.group, entry.pattern),
      sizes,
      sizeSummary,
      sourceImagePath,
      fileName: `${entry.group}_${entry.pattern}.jpg`,
    });
  }

  return result;
}
