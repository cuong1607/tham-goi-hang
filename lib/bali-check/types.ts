// ============================================================
// Types cho module Đối soát Gọi Hàng Thảm Bali To
// ============================================================

/** Một mẫu tồn kho từ Sheet ma trận */
export type BaliAvailableItem = {
  group: string;             // đã normalize: "BACAU", "NT", "NTNEW"
  size: string;              // đã normalize: "200x300", "80x150"
  rawPattern: string;        // tên gốc từ ô sheet: "14(3)", "Nt Đen(2)"
  cleanPattern: string;      // bỏ qty: "14", "Nt Đen"
  normalizedPattern: string; // dùng để so sánh: "14", "nt den"
  availableQuantity: number; // số lượng đang có
};

/** Một dòng trong text gọi hàng thảm Bali To */
export type BaliOrderItem = {
  group: string;             // đã normalize
  size: string;              // đã normalize
  rawPattern: string;        // tên gốc: "17", "Nt Đen(5)"
  cleanPattern: string;      // bỏ qty: "17", "Nt Đen"
  normalizedPattern: string; // dùng để so sánh
  orderQuantity: number;     // số lượng cần gọi
};

/** Status của mỗi item sau khi so sánh */
export type BaliStatus =
  | "already_enough"          // có đủ hàng, không cần gọi
  | "partial_available"       // có nhưng chưa đủ, gọi thêm phần thiếu
  | "need_call_not_found"     // không tìm thấy trong sheet
  | "need_call_different_size"  // có cùng group+pattern nhưng khác size
  | "need_call_different_group"; // có cùng size+pattern nhưng khác group

/** Kết quả so sánh cho một item */
export type BaliCompareResultItem = {
  group: string;
  size: string;
  rawPattern: string;
  cleanPattern: string;
  normalizedPattern: string;
  orderQuantity: number;
  availableQuantity: number;  // 0 nếu không tìm thấy
  missingQuantity: number;    // = orderQuantity - availableQuantity (>= 0)
  status: BaliStatus;
  /** Các size khác có cùng group+pattern (chỉ khi need_call_different_size) */
  foundAtSizes?: string[];
  /** Các group khác có cùng size+pattern (chỉ khi need_call_different_group) */
  foundAtGroups?: string[];
  /** Cảnh báo bổ sung */
  warnings?: string[];
};

/** Toàn bộ kết quả đối soát */
export type BaliCompareResult = {
  /** Chỉ gồm items cần gọi hàng (partial + not_found + different_size/group) */
  needCall: BaliCompareResultItem[];
  /** Items đã có đủ hàng */
  alreadyEnough: BaliCompareResultItem[];
  /** Items có nhưng chưa đủ số lượng (cũng xuất hiện trong needCall) */
  partialAvailable: BaliCompareResultItem[];
  /** Items có cùng group+pattern nhưng khác size */
  differentSize: BaliCompareResultItem[];
  /** Items có cùng size+pattern nhưng khác group */
  differentGroup: BaliCompareResultItem[];
  summary: {
    totalInputItems: number;
    needCallCount: number;
    alreadyEnoughCount: number;
    partialAvailableCount: number;
    differentSizeCount: number;
    differentGroupCount: number;
  };
};
