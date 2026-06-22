// ============================================================
// Types cho module Sinh Ảnh Gọi Hàng Thảm Bali To
// ============================================================

/** Một item sau khi parse text gọi hàng (chưa aggregate) */
export type BaliImageOrderItem = {
  group: string;             // normalized: "BACAU"
  pattern: string;           // raw hiển thị: "08", "Nt Đen"
  normalizedPattern: string; // dùng để so sánh: "8", "nt den"
  size: string;              // normalized: "80x200"
  quantity: number;          // số lượng
};

/** Một size với số lượng trong aggregate */
export type BaliSizeEntry = {
  size: string;           // "80x200"
  displaySize: string;    // "80", "M2", "M4", ...
  quantity: number;
};

/** Một item sau khi aggregate theo group+pattern */
export type BaliImageAggregated = {
  group: string;
  pattern: string;           // raw: "08"
  normalizedPattern: string;
  caption: string;           // "Bắc Âu 08"
  sizes: BaliSizeEntry[];    // đã sort đúng thứ tự
  sizeSummary: string;       // "80(2) + M2 + M4"
  sourceImagePath: string | null;  // null nếu không tìm thấy ảnh
  fileName: string;          // "BACAU_08.jpg"
};

/** Kết quả của một item sau khi render */
export type BaliImageResult = {
  group: string;
  pattern: string;
  caption: string;
  sizeSummary: string;
  sourceImagePath: string | null;
  outputUrl: string | null;   // URL để preview
  fileName: string;
  status: "generated" | "missing_source" | "error";
  errorMessage?: string;
};

/** Response từ API generate */
export type GenerateResponse = {
  success: boolean;
  items: BaliImageResult[];
  missingImages: Array<{ group: string; pattern: string; caption: string }>;
  zipUrl: string | null;
  totalGenerated: number;
  totalMissing: number;
  error?: string;
};
