// ============================================================
// Matcher — đối chiếu text gọi hàng với tồn kho thảm Bali To
// ============================================================

import {
  BaliAvailableItem,
  BaliOrderItem,
  BaliCompareResult,
  BaliCompareResultItem,
} from "./types";

function makeKey(group: string, size: string, norm: string): string {
  return `${group}|||${size}|||${norm}`;
}

/**
 * So sánh danh sách gọi hàng với tồn kho thảm Bali To.
 *
 * Logic matching (không fuzzy — chỉ exact normalizedPattern):
 *
 * 1. Tìm exact key (group + size + normalizedPattern)
 *    a. availableQty >= orderQty → already_enough
 *    b. availableQty < orderQty  → partial_available (gọi thêm missing)
 *
 * 2. Không tìm thấy exact key → check cảnh báo:
 *    a. Cùng group + normalizedPattern, khác size → need_call_different_size
 *    b. Cùng size + normalizedPattern, khác group → need_call_different_group
 *    c. Không tìm thấy đâu → need_call_not_found
 *
 * QUAN TRỌNG: KHÔNG trừ số lượng từ tồn khác size hoặc khác group.
 */
export function compareBaliOrders(
  orders: BaliOrderItem[],
  inventory: BaliAvailableItem[]
): BaliCompareResult {
  const needCall: BaliCompareResultItem[] = [];
  const alreadyEnough: BaliCompareResultItem[] = [];
  const partialAvailable: BaliCompareResultItem[] = [];
  const differentSize: BaliCompareResultItem[] = [];
  const differentGroup: BaliCompareResultItem[] = [];

  // Build exact lookup: key → item
  const exactMap = new Map<string, BaliAvailableItem>();
  for (const inv of inventory) {
    const key = makeKey(inv.group, inv.size, inv.normalizedPattern);
    const existing = exactMap.get(key);
    if (existing) {
      // Nếu đã có (sau aggregate ở parser) thì cộng thêm — safety
      existing.availableQuantity += inv.availableQuantity;
    } else {
      exactMap.set(key, { ...inv });
    }
  }

  // Build secondary lookups for cross-size/cross-group search
  // group+pattern → sizes[]
  const groupPatternToSizes = new Map<string, Set<string>>();
  // size+pattern → groups[]
  const sizePatternToGroups = new Map<string, Set<string>>();

  for (const inv of inventory) {
    const gpKey = `${inv.group}|||${inv.normalizedPattern}`;
    if (!groupPatternToSizes.has(gpKey)) groupPatternToSizes.set(gpKey, new Set());
    groupPatternToSizes.get(gpKey)!.add(inv.size);

    const spKey = `${inv.size}|||${inv.normalizedPattern}`;
    if (!sizePatternToGroups.has(spKey)) sizePatternToGroups.set(spKey, new Set());
    sizePatternToGroups.get(spKey)!.add(inv.group);
  }

  for (const order of orders) {
    const exactKey = makeKey(order.group, order.size, order.normalizedPattern);
    const match = exactMap.get(exactKey);

    if (match) {
      // ---- Tìm thấy exact match ----
      const avail = match.availableQuantity;
      const needed = order.orderQuantity;
      const missing = Math.max(0, needed - avail);

      const item: BaliCompareResultItem = {
        group: order.group,
        size: order.size,
        rawPattern: order.rawPattern,
        cleanPattern: order.cleanPattern,
        normalizedPattern: order.normalizedPattern,
        orderQuantity: needed,
        availableQuantity: avail,
        missingQuantity: missing,
        status: missing === 0 ? "already_enough" : "partial_available",
      };

      if (missing === 0) {
        alreadyEnough.push(item);
      } else {
        partialAvailable.push(item);
        needCall.push({ ...item }); // cũng xuất hiện trong needCall với missingQty
      }
    } else {
      // ---- Không tìm thấy exact match ----
      // Check khác size: cùng group + pattern
      const gpKey = `${order.group}|||${order.normalizedPattern}`;
      const sizesFound = groupPatternToSizes.get(gpKey);
      const otherSizes = sizesFound
        ? Array.from(sizesFound).filter((s) => s !== order.size)
        : [];

      // Check khác group: cùng size + pattern
      const spKey = `${order.size}|||${order.normalizedPattern}`;
      const groupsFound = sizePatternToGroups.get(spKey);
      const otherGroups = groupsFound
        ? Array.from(groupsFound).filter((g) => g !== order.group)
        : [];

      const warnings: string[] = [];
      if (otherSizes.length > 0) {
        warnings.push(
          `Có ${order.group}/${order.cleanPattern} ở size ${otherSizes.join(", ")} nhưng không có ở ${order.size}.`
        );
      }
      if (otherGroups.length > 0) {
        warnings.push(
          `Có ${order.cleanPattern} (size ${order.size}) ở group ${otherGroups.join(", ")} nhưng không có ở group ${order.group}.`
        );
      }

      // Xác định status
      let status: BaliCompareResultItem["status"] = "need_call_not_found";
      if (otherSizes.length > 0 && otherGroups.length > 0) {
        // Ưu tiên báo khác size
        status = "need_call_different_size";
      } else if (otherSizes.length > 0) {
        status = "need_call_different_size";
      } else if (otherGroups.length > 0) {
        status = "need_call_different_group";
      }

      const item: BaliCompareResultItem = {
        group: order.group,
        size: order.size,
        rawPattern: order.rawPattern,
        cleanPattern: order.cleanPattern,
        normalizedPattern: order.normalizedPattern,
        orderQuantity: order.orderQuantity,
        availableQuantity: 0,
        missingQuantity: order.orderQuantity,
        status,
        foundAtSizes: otherSizes.length > 0 ? otherSizes : undefined,
        foundAtGroups: otherGroups.length > 0 ? otherGroups : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

      needCall.push(item);

      if (status === "need_call_different_size") {
        differentSize.push(item);
      } else if (status === "need_call_different_group") {
        differentGroup.push(item);
      }
    }
  }

  return {
    needCall,
    alreadyEnough,
    partialAvailable,
    differentSize,
    differentGroup,
    summary: {
      totalInputItems: orders.length,
      needCallCount: needCall.length,
      alreadyEnoughCount: alreadyEnough.length,
      partialAvailableCount: partialAvailable.length,
      differentSizeCount: differentSize.length,
      differentGroupCount: differentGroup.length,
    },
  };
}

// ============================================================
// Format output text (danh sách cần gọi)
// ============================================================

const GROUP_ORDER = [
  "BACAU", "NT", "NTNEW", "ARAP", "VINTAGE", "CARO", "BALI",
  "TRON", "OVAL", "HD", "PC", "GOC", "THD",
];

const SIZE_ORDER = [
  "80x150", "80x200", "100x100", "100x150",
  "120x120", "120x160", "140x200", "160x160",
  "160x230", "200x300",
];

function sizeKey(s: string): number {
  const idx = SIZE_ORDER.indexOf(s);
  return idx === -1 ? 999 : idx;
}

function groupKey(g: string): number {
  const idx = GROUP_ORDER.indexOf(g);
  return idx === -1 ? 999 : idx;
}

function patternSortKey(p: string): [number, number, string] {
  const n = parseInt(p, 10);
  if (!isNaN(n)) return [0, n, ""];
  return [1, 0, p];
}

/**
 * Format danh sách cần gọi thành text dạng:
 *
 *   BACAU
 *   80x150: 17
 *   80x200: 08
 *   ...
 *
 *   NT
 *   120x160: 02
 *   140x200: 11
 */
export function formatNeedCallText(needCall: BaliCompareResultItem[]): string {
  // Group → Size → [(cleanPattern, missingQty)]
  const data = new Map<string, Map<string, Array<[string, number]>>>();

  for (const item of needCall) {
    if (!data.has(item.group)) data.set(item.group, new Map());
    const sizeMap = data.get(item.group)!;
    if (!sizeMap.has(item.size)) sizeMap.set(item.size, []);
    sizeMap.get(item.size)!.push([item.cleanPattern, item.missingQuantity]);
  }

  const allGroups = Array.from(data.keys());
  const extraGroups = allGroups.filter((g) => !GROUP_ORDER.includes(g));
  const sortedGroups = GROUP_ORDER.filter((g) => data.has(g)).concat(
    extraGroups.sort()
  );

  const lines: string[] = [];
  for (const group of sortedGroups) {
    if (!data.has(group)) continue;
    lines.push(group);
    const sizeMap = data.get(group)!;
    const sizes = Array.from(sizeMap.keys()).sort((a, b) => sizeKey(a) - sizeKey(b));
    for (const size of sizes) {
      const entries = sizeMap.get(size)!.sort((a, b) => {
        const ka = patternSortKey(a[0]);
        const kb = patternSortKey(b[0]);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        if (ka[0] === 0) return ka[1] - kb[1];
        return ka[2].localeCompare(kb[2], "vi");
      });
      const strs = entries.map(([p, q]) => q > 1 ? `${p}(${q})` : p);
      lines.push(`${size}: ${strs.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
