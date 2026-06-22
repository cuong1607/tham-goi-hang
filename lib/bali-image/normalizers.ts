// ============================================================
// Normalizers & Formatters cho module Sinh Ảnh Bali To
// ============================================================

// Re-export từ module chung
export { normalizeSize } from "../order-check/normalizers";

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
// normalizeGroup
// ============================================================

export function normalizeGroup(group: string): string {
  return group.trim().replace(/\s+/g, " ").toUpperCase();
}

// ============================================================
// normalizePattern
// ============================================================

/**
 * Chuẩn hóa pattern để lookup / so sánh:
 * - Bỏ qty trong ngoặc cuối
 * - Bỏ dấu tiếng Việt
 * - Lowercase
 * - Thay _ và - bằng dấu cách
 * - Gom khoảng trắng
 * - Nếu là số thuần: bỏ leading zeros (08 → 8)
 */
export function normalizePattern(pattern: string): string {
  let s = pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
  s = s.replace(/[_\-]/g, " ");
  s = removeDiacritics(s);
  s = s.toLowerCase();
  s = s.replace(/[^\w\s]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
}

// ============================================================
// extractQuantity — lấy số từ "08(2)" → 2
// ============================================================

export function extractQuantity(pattern: string): number {
  const m = pattern.trim().match(/\((\d+)\)\s*$/);
  return m ? parseInt(m[1], 10) : 1;
}

// ============================================================
// cleanPattern — bỏ qty: "08(2)" → "08"
// ============================================================

export function cleanPattern(pattern: string): string {
  return pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

// ============================================================
// Size display mapping (normalized size → label ngắn)
// ============================================================

const SIZE_DISPLAY_MAP: Record<string, string> = {
  "80x150":  "80cmx150cm",
  "100x150": "100cmx150cm",
  "80x200":  "80",
  "120x160": "M2",
  "140x200": "M4",
  "160x230": "M6",
  "200x300": "2M",
};

/**
 * Chuyển size đã normalize về label ngắn hiển thị trên ảnh.
 * Ví dụ: "120x160" → "M2", "80x200" → "80", "80x150" → "80cmx150cm"
 */
export function formatDisplaySize(size: string): string {
  return SIZE_DISPLAY_MAP[size] ?? size;
}

/**
 * Size + quantity: "M2" hoặc "M2(3)"
 */
export function formatDisplaySizeWithQty(size: string, quantity: number): string {
  const label = formatDisplaySize(size);
  return quantity > 1 ? `${label}(${quantity})` : label;
}

// ============================================================
// SIZE_ORDER — thứ tự sort chuẩn
// ============================================================

export const SIZE_ORDER = [
  "80x150",
  "100x150",
  "80x200",
  "120x160",
  "140x200",
  "160x230",
  "200x300",
];

export function sizeOrderIndex(size: string): number {
  const idx = SIZE_ORDER.indexOf(size);
  return idx === -1 ? 999 : idx;
}

/**
 * Build chuỗi size summary từ danh sách size (đã sort):
 * [{ size: "80x200", quantity: 2 }, { size: "120x160", quantity: 1 }]
 * → "80(2) + M2"
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
// Group display name
// ============================================================

const GROUP_LABEL: Record<string, string> = {
  BACAU:      "Bắc Âu",
  NT:         "NT",
  NTNEW:      "NTNEW",
  RETRO:      "Retro",
  BALI:       "Bali",
  CARO:       "Caro",
  HD:         "HD",
  THD:        "THD",
  ARAP:       "Arap",
  VINTAGE:    "Vintage",
  TET:        "Tết",
  TRUUTUONG:  "Trừu Tượng",
};

/**
 * "BACAU" + "08" → "Bắc Âu 08"
 */
export function formatDisplayName(group: string, pattern: string): string {
  const label = GROUP_LABEL[group] ?? group;
  return `${label} ${pattern}`;
}
