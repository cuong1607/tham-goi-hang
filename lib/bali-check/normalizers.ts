// ============================================================
// Normalizers cho module Đối soát Gọi Hàng Thảm Bali To
// ============================================================

// Re-export normalizeSize từ module chung
export { normalizeSize } from "../order-check/normalizers";

// ---- Vietnamese diacritic removal (internal) ----

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
  for (const [pattern, replacement] of VI_MAP) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

// ---- Group normalizer ----

/**
 * Chuẩn hóa tên group:
 * - Trim khoảng trắng
 * - Uppercase
 * - Gom nhiều khoảng trắng thành 1
 *
 * Ví dụ: "bacau" → "BACAU", " NT New " → "NT NEW"
 */
export function normalizeGroup(group: string): string {
  return group.trim().replace(/\s+/g, " ").toUpperCase();
}

// ---- Pattern normalizer ----

/**
 * Lấy số lượng từ pattern nếu có dạng "Tên (3)" hoặc "08(4)".
 * Trả về 1 nếu không có.
 */
export function extractPatternQuantity(pattern: string): number {
  const match = pattern.trim().match(/\((\d+)\)\s*$/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Lấy tên sạch bỏ quantity: "Nt Đen(2)" → "Nt Đen", "08(4)" → "08"
 */
export function cleanPattern(pattern: string): string {
  return pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();
}

/**
 * Chuẩn hóa pattern để so sánh:
 * - Bỏ số lượng trong ngoặc cuối
 * - Trim khoảng trắng
 * - Bỏ dấu tiếng Việt
 * - Lowercase (cho mẫu chữ)
 * - Thay _ và - bằng khoảng trắng
 * - Gom nhiều khoảng trắng thành 1
 * - Nếu là số thuần → bỏ leading zeros: "02" → "2", "08" → "8"
 *
 * Ví dụ:
 *   "02"          → "2"
 *   "08(2)"       → "8"
 *   "14(3)"       → "14"
 *   "Nt Đen"      → "nt den"
 *   "Ngẫu nhiên"  → "ngau nhien"
 *   "xanh lá"     → "xanh la"
 */
export function normalizePattern(pattern: string): string {
  // Bỏ qty trong ngoặc
  let s = pattern.trim().replace(/\s*\(\d+\)\s*$/, "").trim();

  // Thay _ và - bằng khoảng trắng
  s = s.replace(/[_\-]/g, " ");

  // Bỏ dấu tiếng Việt
  s = removeDiacritics(s);

  // Lowercase
  s = s.toLowerCase();

  // Xóa ký tự đặc biệt (giữ chữ số, chữ cái, khoảng trắng)
  s = s.replace(/[^\w\s]/g, " ");

  // Gom khoảng trắng
  s = s.replace(/\s+/g, " ").trim();

  // Nếu là số thuần → bỏ leading zeros
  if (/^\d+$/.test(s)) {
    s = String(parseInt(s, 10));
  }

  return s;
}
