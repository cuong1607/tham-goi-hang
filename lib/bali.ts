// Logic xử lý thảm Bali To (port từ Python skill)

const SIZE_NORM: Record<string, string> = {
  "1m2x1m6": "120cmx160cm",
  "1m6x2m3": "160cmx230cm",
  "1m4x2m":  "140cmx200cm",
  "1m2x1m2": "120cmx120cm",
  "1m6x1m6": "160cmx160cm",
  "80cmx2m":  "80cmx200cm",
  "80cmx1m5": "80cmx150cm",
  "1mx1m":   "100cmx100cm",
  "1mx1m5":  "100cmx150cm",
  "2mx3m":   "200cmx300cm",
};

const GROUP_ORDER = [
  "bacau","nt","ntnew","arap","vintage","caro","bali",
  "tron","oval","hd","pc","goc","thd",
];

const SIZE_ORDER = [
  "80cmx150cm","80cmx200cm","100cmx100cm","100cmx150cm",
  "120cmx120cm","120cmx160cm","140cmx200cm","160cmx160cm",
  "160cmx230cm","200cmx300cm","2mx3m",
];

function parseSku(skuFull: string): { group: string; ma: string; size: string } | null {
  const parts = skuFull.trim().split(/\s+/, 2);
  if (parts.length < 2) return null;

  // Lấy phần từ sau khoảng trắng đầu tiên
  const afterFirstWord = skuFull.trim().indexOf(" ");
  if (afterFirstWord === -1) return null;
  let short = skuFull.trim().slice(afterFirstWord + 1).trim();

  // Chuẩn hoá: xoá khoảng trắng dư quanh _
  short = short.replace(/_\s+/g, "_").replace(/\s+_/g, "_");

  let group: string;
  let rest: string;

  if (/^nt\s+new/i.test(short)) {
    group = "ntnew";
    rest = short.replace(/^nt\s+new_?/i, "").trim();
  } else {
    const uIdx = short.indexOf("_");
    if (uIdx === -1) return null;
    group = short.slice(0, uIdx).toLowerCase().trim();
    rest = short.slice(uIdx + 1);
  }

  if (!rest) return null;

  // Tách size (phần sau _ cuối cùng) và mã (phần trước)
  const lastU = rest.lastIndexOf("_");
  let ma: string;
  let size: string;
  if (lastU === -1) {
    ma = rest.trim();
    size = "?";
  } else {
    ma = rest.slice(0, lastU).trim();
    size = rest.slice(lastU + 1).trim();
  }

  // Normalize size
  size = SIZE_NORM[size.toLowerCase()] ?? size;

  // Đặc biệt nhóm goc: thay _ bằng ' - '
  if (group === "goc") {
    ma = ma.replace(/_/g, " - ");
  }

  // Chuẩn hoá hoa thường "ĐEN" → "Đen"
  if (ma.toUpperCase() === "ĐEN") ma = "Đen";

  return { group, ma, size };
}

type AggKey = string; // "group|||size|||ma"
type AggMap = Map<AggKey, number>;

function makeKey(group: string, size: string, ma: string): AggKey {
  return `${group}|||${size}|||${ma}`;
}

export function processBali(rows: Record<string, unknown>[]): string {
  const agg: AggMap = new Map();

  for (const row of rows) {
    const productInfo = String(row["product_info"] ?? "");
    if (!productInfo || productInfo === "undefined" || productInfo === "null") continue;

    // Tách theo [số]
    const segments = productInfo.split(/\[(\d+)\]/);
    // segments: [before, num, item, num, item, ...]
    // items bắt đầu từ index 2, step 2
    const items: string[] = [];
    for (let i = 2; i < segments.length; i += 2) {
      items.push(segments[i].trim());
    }

    for (const item of items) {
      // Lọc Parent SKU = tham_bali_to
      const parentMatch = item.match(/Parent SKU Reference No\.?:?\s*([^\s;]+)/);
      if (!parentMatch) continue;
      if (parentMatch[1].replace(/;$/, "") !== "tham_bali_to") continue;

      // Lấy SKU Reference No.
      const skuMatch = item.match(/SKU Reference No\.?:?\s*([^;\\]+?)(?:;|\s*Parent SKU|$)/);
      if (!skuMatch) continue;
      const skuRaw = skuMatch[1].trim();

      // Lấy Quantity
      const qtyMatch = item.match(/Quantity:\s*(\d+)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      const parsed = parseSku(skuRaw);
      if (!parsed) continue;

      const { group, ma, size } = parsed;
      const key = makeKey(group, size, ma);
      agg.set(key, (agg.get(key) ?? 0) + qty);
    }
  }

  return formatBali(agg);
}

function formatBali(agg: AggMap): string {
  // Tổ chức dữ liệu: group → size → [(ma, qty)]
  const data = new Map<string, Map<string, Array<[string, number]>>>();

  Array.from(agg.entries()).forEach(([key, qty]) => {
    const [group, size, ma] = key.split("|||");
    if (!data.has(group)) data.set(group, new Map());
    const sizeMap = data.get(group)!;
    if (!sizeMap.has(size)) sizeMap.set(size, []);
    sizeMap.get(size)!.push([ma, qty]);
  });

  const sizeKey = (s: string) => {
    const idx = SIZE_ORDER.indexOf(s);
    return idx === -1 ? 999 : idx;
  };

  const maKey = (x: [string, number]) => {
    const n = parseInt(x[0]);
    if (!isNaN(n)) return [0, n, ""] as [number, number, string];
    return [1, 0, x[0]] as [number, number, string];
  };

  const lines: string[] = [];
  const extraGroups = Array.from(data.keys()).filter(g => !GROUP_ORDER.includes(g));

  for (const group of GROUP_ORDER.concat(extraGroups)) {
    if (!data.has(group)) continue;
    lines.push(group.toUpperCase());
    const sizeMap = data.get(group)!;
    const sizes = Array.from(sizeMap.keys()).sort((a, b) => sizeKey(a) - sizeKey(b));
    for (const size of sizes) {
      const entries = sizeMap.get(size)!.sort((a, b) => {
        const ka = maKey(a);
        const kb = maKey(b);
        if (ka[0] !== kb[0]) return ka[0] - kb[0];
        if (ka[0] === 0) return (ka[1] as number) - (kb[1] as number);
        return (ka[2] as string).localeCompare(kb[2] as string, "vi");
      });
      const strs = entries.map(([m, q]) => q > 1 ? `${m} (${q})` : m);
      lines.push(`${size}: ${strs.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
