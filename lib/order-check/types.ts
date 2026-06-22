// ============================================================
// Types cho module Đối soát Gọi Hàng Theo Mẫu Có Sẵn
// ============================================================

/** Mẫu tồn kho từ Google Sheet / Excel */
export type AvailableSample = {
  size: string;          // đã normalize, ví dụ "50x70"
  rawName: string;       // tên gốc từ bảng, ví dụ "Gấu Viền Trắng (2)"
  cleanName: string;     // sau khi bỏ qty, ví dụ "Gấu Viền Trắng"
  normalizedName: string;// lowercase, bỏ dấu, ví dụ "gau vien trang"
  /** Số lượng tồn kho (từ ngoặc cuối tên). undefined = không ghi số = xem như đủ */
  quantity?: number;
};

/** Một dòng trong text gọi hàng */
export type OrderItem = {
  size: string;          // đã normalize, ví dụ "50x120"
  rawName: string;       // tên gốc từ text, ví dụ "LC_Mèo 3 Sọc"
  cleanName: string;     // sau khi bỏ prefix + qty
  normalizedName: string;// lowercase, bỏ dấu
  quantity: number;      // số lượng (mặc định 1)
};

/** Một alias đã lưu trong DB */
export type AliasRow = {
  id: number;
  alias_raw_name: string;
  alias_normalized_name: string;
  target_raw_name: string;
  target_normalized_name: string;
  confidence: number;
  confirmed_by_user: boolean;
  created_at: string;
  updated_at: string;
};

// ---- Kết quả matching ----

export type MatchType = "exact" | "alias" | "fuzzy_high";

export type AlreadyAvailableItem = {
  size: string;
  orderRawName: string;
  matchedRawName: string;
  matchType: MatchType;
  confidence?: number;
  /** Số lượng đặt hàng */
  orderQty?: number;
  /** Số lượng tồn kho (undefined = đủ hàng, không ghi số) */
  availableQty?: number;
};

export type NeedCallItem = {
  size: string;
  rawName: string;
  cleanName: string;
  /** Số lượng cần gọi (= order_qty - available_qty nếu partial) */
  quantity: number;
  status:
    | "need_call_not_found"      // không có trong sheet
    | "need_call_different_size" // có ở size khác
    | "need_call_partial";       // có trong sheet nhưng không đủ số lượng
  /** Số lượng đang có trong kho (chỉ có khi status = need_call_partial) */
  availableQty?: number;
};

export type DifferentSizeItem = {
  size: string;             // size đang gọi
  rawName: string;          // tên trong text gọi hàng
  foundAtSizes: string[];   // các size khác có mẫu này
};

export type NeedConfirmItem = {
  size: string;
  orderRawName: string;
  candidateRawName: string;
  candidateSize: string;
  confidence: number;
};

export type CompareResult = {
  needCall: NeedCallItem[];
  alreadyAvailable: AlreadyAvailableItem[];
  differentSize: DifferentSizeItem[];
  needConfirm: NeedConfirmItem[];
  summary: {
    totalInputItems: number;
    needCallCount: number;
    availableCount: number;
    differentSizeCount: number;
    needConfirmCount: number;
  };
};
