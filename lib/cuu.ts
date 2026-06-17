// Logic xử lý thảm Cừu To (port từ Python skill)

const CONVERSIONS: Record<string, string> = {
  "1mx1m":   "100cmx100cm",
  "1m2x1m2": "120cmx120cm",
  "1m6x1m6": "160cmx160cm",
  "1m2x1m6": "120cmx160cm",
  "1m4x2m":  "140cmx200cm",
  "1m6x2m3": "160cmx230cm",
  "2mx3m":   "200cmx300cm",
  "80cmx2m":  "80cmx200cm",
  "50cmx1m2": "50cmx120cm",
  "80cmx1m2": "80cmx120cm",
};

const EXCLUDE_SIZES = new Set(["40cmx40cm", "40cmx60cm"]);

const SIZE_ORDER = [
  "50cmx70cm","60cmx60cm","60cmx90cm","80cmx120cm","50cmx120cm",
  "80cmx200cm","100cmx100cm","120cmx120cm","120cmx160cm",
  "140cmx200cm","160cmx160cm","160cmx230cm","200cmx300cm",
];

function normalizeSize(s: string): string {
  s = s.trim();
  // Bỏ tag [Size Lớn]
  s = s.replace(/\[Size Lớn\]/gi, "").trim();
  // Bỏ khoảng trắng quanh x
  s = s.replace(/\s*x\s*/gi, "x");
  // Quy đổi m → cm
  const low = s.toLowerCase();
  if (CONVERSIONS[low]) return CONVERSIONS[low];
  return s;
}

export function processCuu(rows: Record<string, unknown>[]): string {
  // data: size → mau → qty
  const data = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const info = String(row["product_info"] ?? "");
    if (!info || info === "undefined" || info === "null") continue;

    const items = info.split(/\[\d+\]/);
    for (const item of items) {
      if (!item.includes("tham_cuu_to")) continue;

      const qtyMatch = item.match(/Quantity:\s*(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      const varMatch = item.match(/Variation Name:\s*([^;]+)/);
      let mau: string;
      let size: string;

      if (!varMatch) {
        mau = "(không rõ)";
        size = "Bếp Cừu";
      } else {
        const variation = varMatch[1].trim();
        if (variation.includes(",")) {
          const idx = variation.indexOf(",");
          mau = variation.slice(0, idx).trim();
          size = normalizeSize(variation.slice(idx + 1));
        } else {
          mau = variation;
          size = "Bếp Cừu";
        }
      }

      if (EXCLUDE_SIZES.has(size)) continue;

      if (!data.has(size)) data.set(size, new Map());
      const mauMap = data.get(size)!;
      mauMap.set(mau, (mauMap.get(mau) ?? 0) + qty);
    }
  }

  return formatCuu(data);
}

function formatCuu(data: Map<string, Map<string, number>>): string {
  const sizeKey = (s: string) => {
    if (s === "Bếp Cừu") return 999;
    const idx = SIZE_ORDER.indexOf(s);
    return idx === -1 ? 100 : idx;
  };

  const lines: string[] = [];
  const sorted = Array.from(data.keys()).sort((a, b) => sizeKey(a) - sizeKey(b));

  for (const size of sorted) {
    const mauMap = data.get(size)!;
    const parts = Array.from(mauMap.entries()).map(([mau, qty]) =>
      qty === 1 ? mau : `${mau} (${qty})`
    );
    lines.push(`${size}: ${parts.join(", ")}`);
  }

  return lines.join("\n");
}
