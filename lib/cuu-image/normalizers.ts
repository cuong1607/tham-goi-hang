// ============================================================
// Normalizers & Formatters cho module Sinh Ảnh Thảm Cừu To
// ============================================================

// ============================================================
// Vietnamese diacritics removal
// ============================================================

const VI_MAP: [RegExp, string][] = [
  [/[àáâãäåăắặằẳẵấầẩẫậ]/g, "a"],
  [/[èéêëềếệểễ]/g, "e"],
  [/[ìíîïỉị]/g, "i"],
  [/[òóôõöøồốộổỗờớợởỡ]/g, "o"],
  [/[ùúûüừứựửữ]/g, "u"],
  [/[ỳýỹỷỵ]/g, "y"],
  [/[đ]/g, "d"],
  [/[ÀÁÂÃÄÅĂẮẶẰẲẴẤẦẨẪẬ]/g, "a"],
  [/[ÈÉÊËỀẾỆỂỄ]/g, "e"],
  [/[ÌÍÎÏỈỊ]/g, "i"],
  [/[ÒÓÔÕÖØỒỐỘỔỖỜỚỢỞỠ]/g, "o"],
  [/[ÙÚÛÜỪỨỰỬỮ]/g, "u"],
  [/[ỲÝỸỶỴ]/g, "y"],
  [/[Đ]/g, "d"],
];

function removeDiacritics(s: string): string {
  for (const [re, rep] of VI_MAP) s = s.replace(re, rep);
  return s;
}

// ============================================================
// Size conversion — quy đổi m → cm, bỏ tag [Size Lớn]
// ============================================================

const SIZE_CONVERSIONS: Record<string, string> = {
  "1mx1m":   "100x100",
  "1m2x1m2": "120x120",
  "1m6x1m6": "160x160",
  "1m2x1m6": "120x160",
  "1m4x2m":  "140x200",
  "1m6x2m3": "160x230",
  "2mx3m":   "200x300",
  "80cmx2m":  "80x200",
  "50cmx1m2": "50x120",
  "80cmx1m2": "80x120",
};

/**
 * Chuẩn hóa size thảm cừu.
 * Input: "80cmx120cm", "1m2x1m6", "80cm x 120cm", "[Size Lớn] 1m6x2m3"
 * Output: "80x120", "120x160", etc.
 */
export function normalizeSize(s: string): string {
  s = s.trim();
  // Bỏ tag [Size Lớn]
  s = s.replace(/\[Size Lớn\]/gi, "").trim();
  // Bỏ khoảng trắng quanh x
  s = s.replace(/\s*x\s*/gi, "x");

  // Check conversion table (for m-notation)
  const low = s.toLowerCase();
  if (SIZE_CONVERSIONS[low]) return SIZE_CONVERSIONS[low];

  // Try to parse NNcmxNNcm or NNxNN format
  const m = s.match(/^(\d+)(?:cm)?x(\d+)(?:cm)?$/i);
  if (m) return `${parseInt(m[1])}x${parseInt(m[2])}`;

  return s;
}

// ============================================================
// Size display mapping
// ============================================================

const SIZE_DISPLAY_MAP: Record<string, string> = {
  "50x70":   "50cmx70cm",
  "60x60":   "60cmx60cm",
  "60x90":   "60cmx90cm",
  "80x120":  "80cmx120cm",
  "50x120":  "50cmx120cm",
  "80x200":  "80cmx200cm",
  "100x100": "100cmx100cm",
  "120x120": "120cmx120cm",
  "120x160": "120cmx160cm",
  "140x200": "140cmx200cm",
  "160x160": "160cmx160cm",
  "160x230": "160cmx230cm",
  "200x300": "200cmx300cm",
};

export function formatDisplaySize(size: string): string {
  return SIZE_DISPLAY_MAP[size] ?? size;
}

export function formatDisplaySizeWithQty(size: string, quantity: number): string {
  const label = formatDisplaySize(size);
  return quantity > 1 ? `${label}(${quantity})` : label;
}

// ============================================================
// SIZE_ORDER — thứ tự sort chuẩn cho thảm cừu
// ============================================================

export const SIZE_ORDER = [
  "50x70", "60x60", "60x90", "80x120", "50x120",
  "80x200", "100x100", "120x120", "120x160",
  "140x200", "160x160", "160x230", "200x300",
];

export function sizeOrderIndex(size: string): number {
  const idx = SIZE_ORDER.indexOf(size);
  return idx === -1 ? 999 : idx;
}

/**
 * Build chuỗi size summary:
 * [{ size: "80x120", quantity: 2 }, { size: "120x160", quantity: 1 }]
 * → "80cmx120cm(2) + 120cmx160cm"
 */
export function buildSizeSummary(
  sizes: Array<{ size: string; quantity: number }>
): string {
  const sorted = [...sizes].sort(
    (a, b) => sizeOrderIndex(a.size) - sizeOrderIndex(b.size)
  );
  return sorted
    .map((s) => formatDisplaySizeWithQty(s.size, s.quantity))
    .join(" + ");
}

// ============================================================
// normalizePattern
// ============================================================

export function normalizePattern(pattern: string): string {
  let s = pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
  s = removeDiacritics(s);
  s = s.toLowerCase();
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ============================================================
// extractQuantity — lấy số từ "LC_1%(2)" → 2
// ============================================================

export function extractQuantity(pattern: string): number {
  const m = pattern.trim().match(/\((\d+)\)\s*$/);
  return m ? parseInt(m[1], 10) : 1;
}

// ============================================================
// cleanPattern — bỏ qty: "LC_1%(2)" → "LC_1%"
// ============================================================

export function cleanPattern(pattern: string): string {
  return pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

// ============================================================
// Display name — "Cừu LC_1%"
// ============================================================

export function formatDisplayName(pattern: string): string {
  return `Cừu ${pattern}`;
}
