// ============================================================
// Types cho module Sinh Ảnh Gọi Hàng Thảm Cừu To
// ============================================================

/** Một item sau khi parse text gọi hàng (chưa aggregate) */
export type CuuImageOrderItem = {
  pattern: string;           // raw hiển thị: "LC_1%", "LC_Cầu Vồng"
  normalizedPattern: string; // dùng để so sánh: "lc 1%", "lc cau vong"
  size: string;              // normalized: "80x120"
  quantity: number;          // số lượng
};

/** Một size với số lượng trong aggregate */
export type CuuSizeEntry = {
  size: string;           // "80x120"
  displaySize: string;    // "80cmx120cm"
  quantity: number;
};

/** Một item sau khi aggregate theo pattern */
export type CuuImageAggregated = {
  pattern: string;           // raw: "LC_1%"
  normalizedPattern: string;
  caption: string;           // "Cừu LC_1%"
  sizes: CuuSizeEntry[];    // đã sort đúng thứ tự
  sizeSummary: string;       // "80cmx120cm(2) + 120cmx160cm"
  sourceImagePath: string | null;  // null nếu không tìm thấy ảnh
  fileName: string;          // "CUU_LC_1%.jpg"
};

/** Kết quả của một item sau khi render */
export type CuuImageResult = {
  pattern: string;
  caption: string;
  sizeSummary: string;
  sourceImagePath: string | null;
  outputUrl: string | null;
  imageBase64: string | null;
  fileName: string;
  status: "generated" | "missing_source" | "error";
  errorMessage?: string;
};

/** Response từ API generate */
export type CuuGenerateResponse = {
  success: boolean;
  items: CuuImageResult[];
  missingImages: Array<{ pattern: string; caption: string }>;
  zipUrl: string | null;
  zipBase64: string | null;
  totalGenerated: number;
  totalMissing: number;
  error?: string;
};
