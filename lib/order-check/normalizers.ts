// ============================================================
// Normalizers — chuẩn hóa size và tên mẫu
// ============================================================

/**
 * Bảng prefix mặc định cần bỏ khi normalize tên mẫu.
 * Có thể override bằng tham số `prefixes`.
 */
export const DEFAULT_PREFIXES = ["LC_", "BathMat_", "Tufted_", "tham_"];

// ---- Size normalizer ----

/**
 * Chuyển số mét sang cm.
 * Ví dụ: "1m2" -> 120, "2m" -> 200, "80cm" -> 80, "80" -> 80
 */
function parseUnit(s: string): number {
  s = s.trim().toLowerCase();

  // dạng "1m2" = 1.2m = 120cm
  const mDecimal = s.match(/^(\d+)m(\d+)$/);
  if (mDecimal) {
    const whole = parseInt(mDecimal[1], 10);
    const frac = parseInt(mDecimal[2], 10);
    // "1m2" = 120, "1m6" = 160
    return whole * 100 + frac * 10;
  }

  // dạng "2m" = 200cm
  const mOnly = s.match(/^(\d+)m$/);
  if (mOnly) return parseInt(mOnly[1], 10) * 100;

  // dạng "80cm" hoặc "80"
  const cm = s.match(/^(\d+)(?:cm)?$/);
  if (cm) return parseInt(cm[1], 10);

  return NaN;
}

/**
 * Chuẩn hóa size về dạng "WxH" không đơn vị.
 *
 * Hỗ trợ:
 *   50cmx70cm -> 50x70
 *   50x70cm   -> 50x70
 *   50 x 70   -> 50x70
 *   50*70     -> 50x70
 *   50X70     -> 50x70
 *   1m2x1m6   -> 120x160
 *   1m2 x 1m6 -> 120x160
 *   80cmx2m   -> 80x200
 */
export function normalizeSize(size: string): string {
  const s = size.trim().toLowerCase();

  // Tách theo x, X, *, ×, khoảng trắng-x-khoảng trắng
  const parts = s.split(/\s*[xX\*×]\s*/);
  if (parts.length !== 2) return s; // không parse được, trả nguyên

  const w = parseUnit(parts[0]);
  const h = parseUnit(parts[1]);

  if (isNaN(w) || isNaN(h)) return s;
  return `${w}x${h}`;
}

// ---- Vietnamese diacritic removal ----

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

// ---- Name normalizer ----

/**
 * Chuẩn hóa tên mẫu:
 * - Bỏ số lượng trong ngoặc cuối chuỗi: "Gấu Viền Trắng (2)" -> "Gấu Viền Trắng"
 * - Bỏ prefix cấu hình được: LC_, BathMat_, Tufted_, tham_
 * - Thay _ và - bằng khoảng trắng
 * - Bỏ dấu tiếng Việt
 * - Lowercase
 * - Xóa ký tự đặc biệt dư thừa
 * - Trim và gom nhiều khoảng trắng thành 1
 */
export function normalizeName(
  name: string,
  prefixes: string[] = DEFAULT_PREFIXES
): string {
  let s = name.trim();

  // Bỏ số lượng trong ngoặc cuối: (2), (3), ...
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();

  // Bỏ prefix (case-insensitive)
  for (const prefix of prefixes) {
    const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    s = s.replace(re, "");
  }

  // Thay _ và - bằng khoảng trắng
  s = s.replace(/[_\-]/g, " ");

  // Bỏ dấu tiếng Việt
  s = removeDiacritics(s);

  // Lowercase
  s = s.toLowerCase();

  // Xóa ký tự đặc biệt (giữ lại chữ số, chữ cái, khoảng trắng)
  s = s.replace(/[^\w\s]/g, " ");

  // Gom nhiều khoảng trắng thành 1 và trim
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Lấy tên sạch (bỏ qty, bỏ prefix) nhưng GIỮ dấu tiếng Việt.
 * Dùng cho display.
 */
export function cleanName(
  name: string,
  prefixes: string[] = DEFAULT_PREFIXES
): string {
  let s = name.trim();

  // Bỏ số lượng trong ngoặc cuối
  s = s.replace(/\s*\(\d+\)\s*$/, "").trim();

  // Bỏ prefix
  for (const prefix of prefixes) {
    const re = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    s = s.replace(re, "");
  }

  // Thay _ bằng khoảng trắng
  s = s.replace(/_/g, " ");

  return s.trim();
}

/**
 * Lấy số lượng từ tên mẫu nếu có dạng "Tên mẫu (3)".
 * Trả về 1 nếu không có.
 */
export function extractQuantity(name: string): number {
  const match = name.trim().match(/\((\d+)\)\s*$/);
  return match ? parseInt(match[1], 10) : 1;
}
