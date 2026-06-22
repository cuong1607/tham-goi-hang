// ============================================================
// Matcher — đối chiếu text gọi hàng với tồn kho
// ============================================================

import Fuse from "fuse.js";
import {
  AvailableSample,
  OrderItem,
  AliasRow,
  CompareResult,
  AlreadyAvailableItem,
  NeedCallItem,
  DifferentSizeItem,
  NeedConfirmItem,
} from "./types";

const FUZZY_HIGH_THRESHOLD = 90;  // >= 90: coi như match
const FUZZY_LOW_THRESHOLD = 75;   // 75-89: cần xác nhận

// ---- Quantity check helper ----

/**
 * Kiểm tra xem order có thể được đáp ứng bởi inventory item không.
 *
 * Logic:
 * - availableQty = undefined → sheet không ghi số → xem như đủ hàng
 * - orderQty <= availableQty → đủ hàng
 * - orderQty > availableQty → thiếu, cần gọi thêm (orderQty - availableQty)
 */
function checkQuantity(
  orderQty: number,
  availableQty: number | undefined
): { result: "full" } | { result: "partial"; remaining: number } {
  if (availableQty === undefined) return { result: "full" };
  if (orderQty <= availableQty) return { result: "full" };
  return { result: "partial", remaining: orderQty - availableQty };
}

/**
 * So sánh danh sách gọi hàng với tồn kho.
 *
 * Thứ tự matching mỗi item:
 * 1. Exact match (size + normalizedName) + so sánh số lượng
 * 2. Alias match + so sánh số lượng
 * 3. Fuzzy match Fuse.js cùng size + so sánh số lượng
 *    - score >= 90: matched (full hoặc partial)
 *    - score 75-89: cần xác nhận
 * 4. Nếu không match đúng size, check có ở size khác không
 */
export function compareOrders(
  orders: OrderItem[],
  inventory: AvailableSample[],
  aliases: AliasRow[]
): CompareResult {
  const needCall: NeedCallItem[] = [];
  const alreadyAvailable: AlreadyAvailableItem[] = [];
  const differentSize: DifferentSizeItem[] = [];
  const needConfirm: NeedConfirmItem[] = [];

  // Build lookup maps
  const inventoryBySize = new Map<string, AvailableSample[]>();
  for (const s of inventory) {
    if (!inventoryBySize.has(s.size)) inventoryBySize.set(s.size, []);
    inventoryBySize.get(s.size)!.push(s);
  }

  // Build alias lookup: alias_normalized_name -> target
  const aliasMap = new Map<string, AliasRow>();
  for (const a of aliases) {
    if (a.confirmed_by_user) {
      aliasMap.set(a.alias_normalized_name, a);
    }
  }

  for (const order of orders) {
    const sizeInventory = inventoryBySize.get(order.size) ?? [];
    let matched = false;

    // ---- 1. Exact match ----
    const exactMatch = sizeInventory.find(
      (s) => s.normalizedName === order.normalizedName
    );
    if (exactMatch) {
      const qtyCheck = checkQuantity(order.quantity, exactMatch.quantity);

      // Luôn ghi nhận vào "đã có hàng" (kể cả partial)
      alreadyAvailable.push({
        size: order.size,
        orderRawName: order.rawName,
        matchedRawName: exactMatch.rawName,
        matchType: "exact",
        orderQty: order.quantity,
        availableQty: exactMatch.quantity,
      });

      if (qtyCheck.result === "partial") {
        // Có hàng nhưng không đủ — cần gọi thêm phần thiếu
        needCall.push({
          size: order.size,
          rawName: order.rawName,
          cleanName: order.cleanName,
          quantity: qtyCheck.remaining,
          status: "need_call_partial",
          availableQty: exactMatch.quantity,
        });
      }
      matched = true;
    }

    // ---- 2. Alias match ----
    if (!matched) {
      const alias = aliasMap.get(order.normalizedName);
      if (alias) {
        const aliasMatch = sizeInventory.find(
          (s) => s.normalizedName === alias.target_normalized_name
        );
        if (aliasMatch) {
          const qtyCheck = checkQuantity(order.quantity, aliasMatch.quantity);
          alreadyAvailable.push({
            size: order.size,
            orderRawName: order.rawName,
            matchedRawName: aliasMatch.rawName,
            matchType: "alias",
            orderQty: order.quantity,
            availableQty: aliasMatch.quantity,
          });
          if (qtyCheck.result === "partial") {
            needCall.push({
              size: order.size,
              rawName: order.rawName,
              cleanName: order.cleanName,
              quantity: qtyCheck.remaining,
              status: "need_call_partial",
              availableQty: aliasMatch.quantity,
            });
          }
          matched = true;
        }
      }
    }

    // ---- 3. Fuzzy match (cùng size) ----
    if (!matched && sizeInventory.length > 0) {
      const fuse = new Fuse(sizeInventory, {
        keys: ["normalizedName"],
        includeScore: true,
        threshold: 1.0,
        ignoreLocation: true,
      });

      const results = fuse.search(order.normalizedName);
      const best = results[0];

      if (best && best.score !== undefined) {
        const similarity = Math.round((1 - best.score) * 100);

        if (similarity >= FUZZY_HIGH_THRESHOLD) {
          const qtyCheck = checkQuantity(order.quantity, best.item.quantity);
          alreadyAvailable.push({
            size: order.size,
            orderRawName: order.rawName,
            matchedRawName: best.item.rawName,
            matchType: "fuzzy_high",
            confidence: similarity,
            orderQty: order.quantity,
            availableQty: best.item.quantity,
          });
          if (qtyCheck.result === "partial") {
            needCall.push({
              size: order.size,
              rawName: order.rawName,
              cleanName: order.cleanName,
              quantity: qtyCheck.remaining,
              status: "need_call_partial",
              availableQty: best.item.quantity,
            });
          }
          matched = true;
        } else if (similarity >= FUZZY_LOW_THRESHOLD) {
          // Đưa vào cần xác nhận, KHÔNG loại khỏi danh sách cần gọi
          needConfirm.push({
            size: order.size,
            orderRawName: order.rawName,
            candidateRawName: best.item.rawName,
            candidateSize: best.item.size,
            confidence: similarity,
          });
        }
      }
    }

    // ---- 4. Không match đúng size -> check size khác ----
    if (!matched) {
      const foundAtSizes: string[] = [];

      for (const [size, samples] of inventoryBySize) {
        if (size === order.size) continue;

        const foundExact = samples.find(
          (s: AvailableSample) => s.normalizedName === order.normalizedName
        );

        const alias = aliasMap.get(order.normalizedName);
        const foundAlias = alias
          ? samples.find((s: AvailableSample) => s.normalizedName === alias.target_normalized_name)
          : undefined;

        let foundFuzzy = false;
        if (!foundExact && !foundAlias && samples.length > 0) {
          const fuse = new Fuse(samples, {
            keys: ["normalizedName"],
            includeScore: true,
            threshold: 1.0,
            ignoreLocation: true,
          });
          const results = fuse.search(order.normalizedName);
          const best = results[0];
          if (best && best.score !== undefined) {
            const sim = Math.round((1 - best.score) * 100);
            if (sim >= FUZZY_HIGH_THRESHOLD) foundFuzzy = true;
          }
        }

        if (foundExact || foundAlias || foundFuzzy) {
          foundAtSizes.push(size);
        }
      }

      if (foundAtSizes.length > 0) {
        differentSize.push({
          size: order.size,
          rawName: order.rawName,
          foundAtSizes,
        });
        needCall.push({
          size: order.size,
          rawName: order.rawName,
          cleanName: order.cleanName,
          quantity: order.quantity,
          status: "need_call_different_size",
        });
      } else {
        needCall.push({
          size: order.size,
          rawName: order.rawName,
          cleanName: order.cleanName,
          quantity: order.quantity,
          status: "need_call_not_found",
        });
      }
    }
  }

  return {
    needCall,
    alreadyAvailable,
    differentSize,
    needConfirm,
    summary: {
      totalInputItems: orders.length,
      needCallCount: needCall.length,
      availableCount: alreadyAvailable.length,
      differentSizeCount: differentSize.length,
      needConfirmCount: needConfirm.length,
    },
  };
}
